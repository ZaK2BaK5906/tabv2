local resourceName = GetCurrentResourceName()

local Modules = {}

local function registerModule(name, module)
  Modules[name] = module
end

local function getPlayerJob(playerId)
  local xPlayer = ESX.GetPlayerFromId(playerId)
  if not xPlayer then
    return nil
  end
  return {
    identifier = xPlayer.identifier,
    name = xPlayer.getJob().name,
    grade = xPlayer.getJob().grade,
    gradeName = xPlayer.getJob().grade_name
  }
end

local function hasPermission(playerId, job, minGrade)
  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    return false
  end
  if playerJob.name ~= job then
    return false
  end
  return playerJob.grade >= minGrade
end

local function isBoss(playerId)
  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    return false
  end
  return playerJob.gradeName == Config.BossGradeName
end

local function ensureTables()
  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_tax_settings (
      id INT NOT NULL AUTO_INCREMENT,
      default_rate FLOAT NOT NULL DEFAULT 0.15,
      allow_tax_free TINYINT(1) NOT NULL DEFAULT 1,
      allow_doj_tax_free TINYINT(1) NOT NULL DEFAULT 1,
      max_tax_free_invoice INT NOT NULL DEFAULT 10000,
      alert_threshold_tax_free INT NOT NULL DEFAULT 5,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  ]])

  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_tax_rules (
      id INT NOT NULL AUTO_INCREMENT,
      job_name VARCHAR(60) NOT NULL,
      rate FLOAT NOT NULL DEFAULT 0.15,
      allow_tax_free TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_mdt_tax_rules_job (job_name)
    )
  ]])

  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_products (
      id INT NOT NULL AUTO_INCREMENT,
      job_name VARCHAR(60) NOT NULL,
      label VARCHAR(120) NOT NULL,
      price INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_mdt_products_job (job_name)
    )
  ]])

  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_invoices (
      id INT NOT NULL AUTO_INCREMENT,
      invoice_id VARCHAR(64) NOT NULL,
      job_name VARCHAR(60) NOT NULL,
      issuer_identifier VARCHAR(60) NOT NULL,
      issuer_name VARCHAR(120) NOT NULL,
      target_identifier VARCHAR(60) DEFAULT NULL,
      target_name VARCHAR(120) DEFAULT NULL,
      mode VARCHAR(40) NOT NULL DEFAULT 'citoyen',
      product_label VARCHAR(120) NOT NULL,
      amount_ht INT NOT NULL DEFAULT 0,
      tax_rate FLOAT NOT NULL DEFAULT 0,
      tax_amount INT NOT NULL DEFAULT 0,
      total_ttc INT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      tax_free_reason VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_mdt_invoices_invoice_id (invoice_id),
      KEY idx_mdt_invoices_job (job_name),
      KEY idx_mdt_invoices_target (target_identifier)
    )
  ]])
end

local function loadTaxSettings()
  MySQL.query('SELECT * FROM mdt_tax_settings LIMIT 1', {}, function(rows)
    if not rows or #rows == 0 then
      MySQL.insert(
        [[
          INSERT INTO mdt_tax_settings
            (default_rate, allow_tax_free, allow_doj_tax_free, max_tax_free_invoice, alert_threshold_tax_free)
          VALUES (?, ?, ?, ?, ?)
        ]],
        {
          Config.Taxes.defaultRate,
          Config.Taxes.allowTaxFree and 1 or 0,
          Config.Taxes.allowDojTaxFree and 1 or 0,
          Config.Taxes.maxTaxFreeInvoice,
          Config.Taxes.alertThresholdTaxFree
        }
      )
      return
    end

    local row = rows[1]
    Config.Taxes.defaultRate = row.default_rate
    Config.Taxes.allowTaxFree = row.allow_tax_free == 1
    Config.Taxes.allowDojTaxFree = row.allow_doj_tax_free == 1
    Config.Taxes.maxTaxFreeInvoice = row.max_tax_free_invoice
    Config.Taxes.alertThresholdTaxFree = row.alert_threshold_tax_free
  end)
end

local function refreshClients(entity)
  TriggerClientEvent('mdt:client:dataUpdated', -1, { entity = entity })
end

local function giveInvoiceItem(playerId, payload)
  if not exports.ox_inventory then
    return
  end

  local job = getPlayerJob(playerId)
  local metadata = {
    invoice_id = payload.invoiceId or ('INV-' .. os.time()),
    mode = payload.mode or 'citoyen',
    product = payload.product or 'Prestation',
    amount = payload.amount or 0,
    tax_rate = payload.taxRate or Config.Taxes.defaultRate,
    tax_amount = payload.taxAmount or 0,
    total = payload.total or 0,
    issuer = payload.issuer or GetPlayerName(playerId),
    job = job and job.name or 'unknown',
    created_at = os.date('%Y-%m-%d %H:%M:%S')
  }

  exports.ox_inventory:AddItem(playerId, Config.InvoiceItem, 1, metadata)
end

RegisterNetEvent('mdt:server:ready', function()
  local playerId = source
  TriggerClientEvent('mdt:client:ready', playerId, {
    resource = resourceName
  })
end)

MySQL.ready(function()
  ensureTables()
  loadTaxSettings()
end)

ESX.RegisterServerCallback('mdt:server:getOverview', function(source, cb)
  local playerJob = getPlayerJob(source)
  cb({
    ok = true,
    job = playerJob,
    taxes = Config.Taxes,
    commissions = Config.Commissions
  })
end)

ESX.RegisterServerCallback('mdt:server:getEmployees', function(source, cb)
  local playerJob = getPlayerJob(source)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  MySQL.query(
    'SELECT identifier, firstname, lastname, job_grade FROM users WHERE job = ?',
    { playerJob.name },
    function(rows)
      local employees = {}
      for _, row in ipairs(rows) do
        table.insert(employees, {
          identifier = row.identifier,
          name = string.format('%s %s', row.firstname or '', row.lastname or ''),
          grade = row.job_grade
        })
      end
      cb({ ok = true, employees = employees })
    end
  )
end)

ESX.RegisterServerCallback('mdt:server:getTaxSettings', function(source, cb)
  cb({
    ok = true,
    taxes = Config.Taxes
  })
end)

ESX.RegisterServerCallback('mdt:server:getInvoices', function(source, cb)
  local playerJob = getPlayerJob(source)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  local isDoj = hasPermission(source, 'doj', Config.Jobs.doj.minGrade)
  local query = [[
    SELECT invoice_id, job_name, issuer_name, target_name, mode, product_label, amount_ht, tax_rate, tax_amount, total_ttc, status, tax_free_reason, created_at
    FROM mdt_invoices
  ]]
  local params = {}

  if not isDoj then
    query = query .. ' WHERE job_name = ?'
    params = { playerJob.name }
  end

  query = query .. ' ORDER BY created_at DESC LIMIT 200'

  MySQL.query(query, params, function(rows)
    cb({ ok = true, invoices = rows or {} })
  end)
end)

ESX.RegisterServerCallback('mdt:server:createInvoice', function(source, cb, payload)
  local playerJob = getPlayerJob(source)
  if not playerJob or not payload or type(payload) ~= 'table' then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local invoiceId = payload.invoiceId or ('INV-' .. os.time())
  local issuerName = payload.issuer or GetPlayerName(source)
  local amount = tonumber(payload.amount) or 0
  local taxRate = tonumber(payload.taxRate) or Config.Taxes.defaultRate
  local taxAmount = tonumber(payload.taxAmount) or 0
  local total = tonumber(payload.total) or (amount + taxAmount)

  MySQL.insert(
    [[
      INSERT INTO mdt_invoices
        (invoice_id, job_name, issuer_identifier, issuer_name, target_identifier, target_name, mode, product_label, amount_ht, tax_rate, tax_amount, total_ttc, status, tax_free_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]],
    {
      invoiceId,
      playerJob.name,
      playerJob.identifier or playerJob.name,
      issuerName,
      payload.targetIdentifier,
      payload.targetName,
      payload.mode or 'citoyen',
      payload.product or 'Prestation',
      amount,
      taxRate,
      taxAmount,
      total,
      payload.status or 'pending',
      payload.taxFreeReason
    },
    function()
      if payload.giveItem then
        giveInvoiceItem(source, payload)
      end
      refreshClients('invoices')
      cb({ ok = true, invoiceId = invoiceId })
    end
  )
end)

ESX.RegisterServerCallback('mdt:server:hireEmployee', function(source, cb, targetId)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  local bossJob = getPlayerJob(playerId)
  local target = ESX.GetPlayerFromId(targetId)
  if not bossJob or not target then
    cb({ ok = false, reason = 'invalid_target' })
    return
  end

  target.setJob(bossJob.name, 0)
  cb({ ok = true })
end)

ESX.RegisterServerCallback('mdt:server:fireEmployee', function(source, cb, targetId)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  local target = ESX.GetPlayerFromId(targetId)
  if not target then
    cb({ ok = false, reason = 'invalid_target' })
    return
  end

  target.setJob(Config.DefaultJob, 0)
  cb({ ok = true })
end)

ESX.RegisterServerCallback('mdt:server:promoteEmployee', function(source, cb, targetId, newGrade)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  local bossJob = getPlayerJob(playerId)
  local target = ESX.GetPlayerFromId(targetId)
  if not bossJob or not target then
    cb({ ok = false, reason = 'invalid_target' })
    return
  end

  target.setJob(bossJob.name, newGrade)
  cb({ ok = true })
end)

RegisterNetEvent('mdt:server:updateTaxRate', function(rate)
  local playerId = source
  if not hasPermission(playerId, 'doj', Config.Jobs.doj.minGrade) then
    return
  end
  Config.Taxes.defaultRate = rate
  MySQL.update('UPDATE mdt_tax_settings SET default_rate = ? WHERE id = 1', { rate })
  TriggerClientEvent('mdt:client:taxRateUpdated', -1, rate)
  refreshClients('taxes')
end)

RegisterNetEvent('mdt:server:createInvoiceItem', function(payload)
  local playerId = source
  if not payload or type(payload) ~= 'table' then
    return
  end

  giveInvoiceItem(playerId, payload)
end)

registerModule('employees', {
  isBoss = isBoss
})

registerModule('core', {
  hasPermission = hasPermission,
  isBoss = isBoss
})

exports('registerModule', registerModule)
exports('getModule', function(name)
  return Modules[name]
end)
