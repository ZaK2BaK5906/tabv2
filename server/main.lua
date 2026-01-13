local resourceName = GetCurrentResourceName()
local ESX = exports['es_extended'] and exports['es_extended']:getSharedObject() or nil

CreateThread(function()
  while not ESX do
    TriggerEvent('esx:getSharedObject', function(obj)
      ESX = obj
    end)
    if not ESX and exports['es_extended'] then
      ESX = exports['es_extended']:getSharedObject()
    end
    Wait(500)
  end
end)

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

  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_partnerships (
      id INT NOT NULL AUTO_INCREMENT,
      job_name VARCHAR(60) NOT NULL,
      partner_name VARCHAR(120) NOT NULL,
      discount_rate FLOAT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'active',
      notes VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_mdt_partnerships_job (job_name)
    )
  ]])

  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_commission_payouts (
      id INT NOT NULL AUTO_INCREMENT,
      job_name VARCHAR(60) NOT NULL,
      employee_identifier VARCHAR(60) NOT NULL,
      employee_name VARCHAR(120) NOT NULL,
      amount INT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_mdt_commission_job (job_name),
      KEY idx_mdt_commission_employee (employee_identifier)
    )
  ]])

  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_employee_stats (
      id INT NOT NULL AUTO_INCREMENT,
      job_name VARCHAR(60) NOT NULL,
      employee_identifier VARCHAR(60) NOT NULL,
      invoices_count INT NOT NULL DEFAULT 0,
      sales_total INT NOT NULL DEFAULT 0,
      commission_rate FLOAT NOT NULL DEFAULT 0.05,
      commission_due INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_mdt_employee_stats (job_name, employee_identifier)
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

local function sendWebhook(eventTitle, fields)
  if not Config.Webhooks or not Config.Webhooks.enabled then
    return
  end
  if not Config.Webhooks.staff or Config.Webhooks.staff == '' then
    return
  end

  local payload = {
    username = 'MDT Logs',
    embeds = {
      {
        title = eventTitle,
        color = 15105570,
        fields = fields or {},
        footer = { text = resourceName }
      }
    }
  }

  PerformHttpRequest(
    Config.Webhooks.staff,
    function() end,
    'POST',
    json.encode(payload),
    { ['Content-Type'] = 'application/json' }
  )
end

local function playerLabel(playerId)
  local name = GetPlayerName(playerId) or 'unknown'
  local identifier = GetPlayerIdentifier(playerId, 0) or 'unknown'
  return string.format('%s (%s)', name, identifier)
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

-- Get full player data for the tablet UI
ESX.RegisterServerCallback('mdt:server:getPlayerData', function(source, cb)
  local xPlayer = ESX.GetPlayerFromId(source)
  if not xPlayer then
    cb({ ok = false, reason = 'player_not_found' })
    return
  end

  local job = xPlayer.getJob()
  local money = xPlayer.getMoney()
  local bank = xPlayer.getAccount('bank')

  -- Get player name from database for proper firstname/lastname
  MySQL.query('SELECT firstname, lastname FROM users WHERE identifier = ?', { xPlayer.identifier }, function(rows)
    local firstname = 'Inconnu'
    local lastname = ''

    if rows and rows[1] then
      firstname = rows[1].firstname or 'Inconnu'
      lastname = rows[1].lastname or ''
    end

    -- Check if player is boss
    local isBoss = job.grade_name == Config.BossGradeName

    cb({
      ok = true,
      player = {
        identifier = xPlayer.identifier,
        firstname = firstname,
        lastname = lastname,
        fullname = string.format('%s %s', firstname, lastname),
        job = {
          name = job.name,
          label = job.label,
          grade = job.grade,
          gradeName = job.grade_name,
          gradeLabel = job.grade_label
        },
        money = {
          cash = money or 0,
          bank = bank and bank.money or 0
        },
        isBoss = isBoss
      }
    })
  end)
end)

-- Get dashboard statistics from SQL
ESX.RegisterServerCallback('mdt:server:getDashboardStats', function(source, cb)
  local playerJob = getPlayerJob(source)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  local stats = {
    totalInvoiced = 0,
    taxesDue = 0,
    commissionsTotal = 0,
    employeesCount = 0,
    myInvoicesCount = 0,
    mySalesTotal = 0,
    myCommissionDue = 0
  }

  -- Get total invoiced in last 30 days
  MySQL.query([[
    SELECT
      COALESCE(SUM(total_ttc), 0) as total_invoiced,
      COALESCE(SUM(tax_amount), 0) as taxes_due
    FROM mdt_invoices
    WHERE job_name = ?
    AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  ]], { playerJob.name }, function(invoiceRows)
    if invoiceRows and invoiceRows[1] then
      stats.totalInvoiced = invoiceRows[1].total_invoiced or 0
      stats.taxesDue = invoiceRows[1].taxes_due or 0
    end

    -- Get total commissions
    MySQL.query([[
      SELECT COALESCE(SUM(amount), 0) as total_commissions
      FROM mdt_commission_payouts
      WHERE job_name = ?
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ]], { playerJob.name }, function(commRows)
      if commRows and commRows[1] then
        stats.commissionsTotal = commRows[1].total_commissions or 0
      end

      -- Get employees count
      MySQL.query('SELECT COUNT(*) as count FROM users WHERE job = ?', { playerJob.name }, function(empRows)
        if empRows and empRows[1] then
          stats.employeesCount = empRows[1].count or 0
        end

        -- Get my personal stats
        MySQL.query([[
          SELECT
            COALESCE(invoices_count, 0) as invoices_count,
            COALESCE(sales_total, 0) as sales_total,
            COALESCE(commission_due, 0) as commission_due
          FROM mdt_employee_stats
          WHERE job_name = ? AND employee_identifier = ?
        ]], { playerJob.name, playerJob.identifier }, function(myRows)
          if myRows and myRows[1] then
            stats.myInvoicesCount = myRows[1].invoices_count or 0
            stats.mySalesTotal = myRows[1].sales_total or 0
            stats.myCommissionDue = myRows[1].commission_due or 0
          end

          cb({ ok = true, stats = stats })
        end)
      end)
    end)
  end)
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

ESX.RegisterServerCallback('mdt:server:getEmployeeStats', function(source, cb)
  local playerJob = getPlayerJob(source)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  MySQL.query(
    [[
      SELECT
        users.identifier,
        users.firstname,
        users.lastname,
        users.job_grade,
        stats.invoices_count,
        stats.sales_total,
        stats.commission_rate,
        stats.commission_due
      FROM users
      LEFT JOIN mdt_employee_stats stats
        ON stats.employee_identifier = users.identifier
        AND stats.job_name = users.job
      WHERE users.job = ?
    ]],
    { playerJob.name },
    function(rows)
      cb({ ok = true, employees = rows or {} })
    end
  )
end)

ESX.RegisterServerCallback('mdt:server:updateCommissionRate', function(source, cb, payload)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end
  if not payload or not payload.identifier or not payload.rate then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  MySQL.update(
    [[
      INSERT INTO mdt_employee_stats (job_name, employee_identifier, commission_rate)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE commission_rate = VALUES(commission_rate)
    ]],
    { playerJob.name, payload.identifier, payload.rate },
    function()
      refreshClients('employees')
      sendWebhook('Commission modifiée', {
        { name = 'Patron', value = playerLabel(playerId), inline = true },
        { name = 'Employé', value = payload.identifier, inline = true },
        { name = 'Taux', value = tostring(payload.rate), inline = true },
        { name = 'Entreprise', value = playerJob.name, inline = true }
      })
      cb({ ok = true })
    end
  )
end)

ESX.RegisterServerCallback('mdt:server:resetEmployeeStats', function(source, cb, identifier)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  local playerJob = getPlayerJob(playerId)
  if not playerJob or not identifier then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  MySQL.update(
    [[
      INSERT INTO mdt_employee_stats (job_name, employee_identifier, invoices_count, sales_total, commission_due)
      VALUES (?, ?, 0, 0, 0)
      ON DUPLICATE KEY UPDATE invoices_count = 0, sales_total = 0, commission_due = 0
    ]],
    { playerJob.name, identifier },
    function()
      refreshClients('employees')
      sendWebhook('Reset stats employé', {
        { name = 'Patron', value = playerLabel(playerId), inline = true },
        { name = 'Employé', value = identifier, inline = true },
        { name = 'Entreprise', value = playerJob.name, inline = true }
      })
      cb({ ok = true })
    end
  )
end)

ESX.RegisterServerCallback('mdt:server:getTaxSettings', function(source, cb)
  cb({
    ok = true,
    taxes = Config.Taxes
  })
end)

ESX.RegisterServerCallback('mdt:server:getPartnerships', function(source, cb)
  local playerJob = getPlayerJob(source)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  MySQL.query(
    'SELECT id, partner_name, discount_rate, status, notes, updated_at FROM mdt_partnerships WHERE job_name = ? ORDER BY updated_at DESC',
    { playerJob.name },
    function(rows)
      cb({ ok = true, partnerships = rows or {} })
    end
  )
end)

ESX.RegisterServerCallback('mdt:server:savePartnership', function(source, cb, payload)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end
  if not payload or not payload.partner_name then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  if payload.id then
    MySQL.update(
      [[
        UPDATE mdt_partnerships
        SET partner_name = ?, discount_rate = ?, status = ?, notes = ?
        WHERE id = ? AND job_name = ?
      ]],
      {
        payload.partner_name,
        payload.discount_rate or 0,
        payload.status or 'active',
        payload.notes,
        payload.id,
        playerJob.name
      },
      function()
        refreshClients('partnerships')
        sendWebhook('Partenariat modifié', {
          { name = 'Patron', value = playerLabel(playerId), inline = true },
          { name = 'Entreprise', value = playerJob.name, inline = true },
          { name = 'Partenaire', value = payload.partner_name, inline = true },
          { name = 'Réduction', value = tostring(payload.discount_rate or 0), inline = true },
          { name = 'Statut', value = payload.status or 'active', inline = true }
        })
        cb({ ok = true })
      end
    )
    return
  end

  MySQL.insert(
    [[
      INSERT INTO mdt_partnerships (job_name, partner_name, discount_rate, status, notes)
      VALUES (?, ?, ?, ?, ?)
    ]],
    {
      playerJob.name,
      payload.partner_name,
      payload.discount_rate or 0,
      payload.status or 'active',
      payload.notes
    },
    function()
      refreshClients('partnerships')
      sendWebhook('Partenariat créé', {
        { name = 'Patron', value = playerLabel(playerId), inline = true },
        { name = 'Entreprise', value = playerJob.name, inline = true },
        { name = 'Partenaire', value = payload.partner_name, inline = true },
        { name = 'Réduction', value = tostring(payload.discount_rate or 0), inline = true },
        { name = 'Statut', value = payload.status or 'active', inline = true }
      })
      cb({ ok = true })
    end
  )
end)

ESX.RegisterServerCallback('mdt:server:getCommissions', function(source, cb)
  local playerJob = getPlayerJob(source)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  MySQL.query(
    [[
      SELECT id, employee_name, amount, status, created_at
      FROM mdt_commission_payouts
      WHERE job_name = ?
      ORDER BY created_at DESC
      LIMIT 200
    ]],
    { playerJob.name },
    function(rows)
      cb({ ok = true, payouts = rows or {} })
    end
  )
end)

ESX.RegisterServerCallback('mdt:server:createCommissionPayout', function(source, cb, payload)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end
  if not payload or not payload.employeeIdentifier or not payload.employeeName or not payload.amount then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  MySQL.insert(
    [[
      INSERT INTO mdt_commission_payouts (job_name, employee_identifier, employee_name, amount, status)
      VALUES (?, ?, ?, ?, ?)
    ]],
    {
      playerJob.name,
      payload.employeeIdentifier,
      payload.employeeName,
      payload.amount,
      payload.status or 'pending'
    },
    function()
      refreshClients('commissions')
      sendWebhook('Commission créée', {
        { name = 'Patron', value = playerLabel(playerId), inline = true },
        { name = 'Employé', value = payload.employeeName, inline = true },
        { name = 'Montant', value = tostring(payload.amount), inline = true },
        { name = 'Entreprise', value = playerJob.name, inline = true }
      })
      cb({ ok = true })
    end
  )
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
      sendWebhook('Facture créée', {
        { name = 'Émetteur', value = playerLabel(source), inline = true },
        { name = 'Entreprise', value = playerJob.name, inline = true },
        { name = 'Mode', value = payload.mode or 'citoyen', inline = true },
        { name = 'Montant', value = tostring(total), inline = true },
        { name = 'Facture', value = invoiceId, inline = true }
      })
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
  sendWebhook('Employé recruté', {
    { name = 'Patron', value = playerLabel(playerId), inline = true },
    { name = 'Employé', value = playerLabel(targetId), inline = true },
    { name = 'Entreprise', value = bossJob.name, inline = true }
  })
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
  sendWebhook('Employé licencié', {
    { name = 'Patron', value = playerLabel(playerId), inline = true },
    { name = 'Employé', value = playerLabel(targetId), inline = true },
    { name = 'Entreprise', value = (getPlayerJob(playerId) or {}).name or 'unknown', inline = true }
  })
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
  sendWebhook('Employé promu', {
    { name = 'Patron', value = playerLabel(playerId), inline = true },
    { name = 'Employé', value = playerLabel(targetId), inline = true },
    { name = 'Entreprise', value = bossJob.name, inline = true },
    { name = 'Nouveau grade', value = tostring(newGrade), inline = true }
  })
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
  sendWebhook('TVA modifiée', {
    { name = 'Agent DOJ', value = playerLabel(playerId), inline = true },
    { name = 'Nouveau taux', value = tostring(rate), inline = true }
  })
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

-- ============================================
-- CITIZEN INVOICE SYSTEM
-- ============================================

-- Get invoices for the current player (citizen view)
ESX.RegisterServerCallback('mdt:server:getMyInvoices', function(source, cb)
  local xPlayer = ESX.GetPlayerFromId(source)
  if not xPlayer then
    cb({ ok = false, reason = 'player_not_found' })
    return
  end

  MySQL.query([[
    SELECT id, invoice_id, job_name, issuer_name, product_label, amount_ht, tax_rate, tax_amount, total_ttc, status, created_at
    FROM mdt_invoices
    WHERE target_identifier = ?
    ORDER BY created_at DESC
    LIMIT 100
  ]], { xPlayer.identifier }, function(rows)
    cb({ ok = true, invoices = rows or {} })
  end)
end)

-- Pay an invoice (personal or company)
ESX.RegisterServerCallback('mdt:server:payInvoice', function(source, cb, payload)
  local xPlayer = ESX.GetPlayerFromId(source)
  if not xPlayer or not payload or not payload.invoiceId then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local invoiceId = payload.invoiceId
  local payFromCompany = payload.payFromCompany or false
  local amount = tonumber(payload.amount) or 0

  -- Get the invoice
  MySQL.query('SELECT * FROM mdt_invoices WHERE invoice_id = ? AND status = ?', { invoiceId, 'pending' }, function(rows)
    if not rows or #rows == 0 then
      cb({ ok = false, reason = 'invoice_not_found' })
      return
    end

    local invoice = rows[1]

    -- Check if paying from company account
    if payFromCompany then
      -- Must be a boss
      local job = xPlayer.getJob()
      if job.grade_name ~= Config.BossGradeName then
        cb({ ok = false, reason = 'not_boss' })
        return
      end

      -- Get society money using esx_addonaccount or esx_society
      TriggerEvent('esx_addonaccount:getSharedAccount', 'society_' .. job.name, function(account)
        if not account then
          -- Try alternative method
          MySQL.query('SELECT money FROM addon_account_data WHERE account_name = ?', { 'society_' .. job.name }, function(accountRows)
            if not accountRows or #accountRows == 0 then
              cb({ ok = false, reason = 'no_society_account' })
              return
            end

            local societyMoney = accountRows[1].money or 0
            if societyMoney < amount then
              cb({ ok = false, reason = 'insufficient_society_funds' })
              return
            end

            -- Deduct from society
            MySQL.update('UPDATE addon_account_data SET money = money - ? WHERE account_name = ?', { amount, 'society_' .. job.name })

            -- Mark invoice as paid
            MySQL.update('UPDATE mdt_invoices SET status = ?, paid_at = NOW() WHERE invoice_id = ?', { 'paid', invoiceId })

            -- Add money to the invoice issuer's society
            MySQL.update('UPDATE addon_account_data SET money = money + ? WHERE account_name = ?', { amount, 'society_' .. invoice.job_name })

            refreshClients('invoices')
            sendWebhook('Facture payée (Entreprise)', {
              { name = 'Payeur', value = playerLabel(source), inline = true },
              { name = 'Facture', value = invoiceId, inline = true },
              { name = 'Montant', value = tostring(amount), inline = true },
              { name = 'Entreprise payeuse', value = job.name, inline = true }
            })
            cb({ ok = true })
          end)
          return
        end

        if account.money < amount then
          cb({ ok = false, reason = 'insufficient_society_funds' })
          return
        end

        account.removeMoney(amount)

        -- Mark invoice as paid
        MySQL.update('UPDATE mdt_invoices SET status = ?, paid_at = NOW() WHERE invoice_id = ?', { 'paid', invoiceId })

        -- Add money to the invoice issuer's society
        TriggerEvent('esx_addonaccount:getSharedAccount', 'society_' .. invoice.job_name, function(targetAccount)
          if targetAccount then
            targetAccount.addMoney(amount)
          end
        end)

        refreshClients('invoices')
        cb({ ok = true })
      end)
    else
      -- Personal payment from bank
      local bank = xPlayer.getAccount('bank')
      if not bank or bank.money < amount then
        cb({ ok = false, reason = 'insufficient_funds' })
        return
      end

      xPlayer.removeAccountMoney('bank', amount, 'Invoice payment: ' .. invoiceId)

      -- Mark invoice as paid
      MySQL.update('UPDATE mdt_invoices SET status = ?, paid_at = NOW() WHERE invoice_id = ?', { 'paid', invoiceId })

      -- Add money to the invoice issuer's society
      TriggerEvent('esx_addonaccount:getSharedAccount', 'society_' .. invoice.job_name, function(account)
        if account then
          account.addMoney(amount)
        else
          -- Fallback: add to addon_account_data directly
          MySQL.update('UPDATE addon_account_data SET money = money + ? WHERE account_name = ?', { amount, 'society_' .. invoice.job_name })
        end
      end)

      refreshClients('invoices')
      sendWebhook('Facture payée', {
        { name = 'Payeur', value = playerLabel(source), inline = true },
        { name = 'Facture', value = invoiceId, inline = true },
        { name = 'Montant', value = tostring(amount), inline = true }
      })
      cb({ ok = true })
    end
  end)
end)

-- ============================================
-- DEALERSHIP SYSTEM
-- Stock is managed in the `vehicles` table (column: stock)
-- When ordering: stock++ in vehicles table
-- When assigning: stock-- in vehicles AND insert into owned_vehicles for client
-- ============================================

-- Get vehicle catalog from SQL (vehicles table with stock)
ESX.RegisterServerCallback('mdt:server:getVehicleCatalog', function(source, cb)
  local playerJob = getPlayerJob(source)
  if not playerJob or (playerJob.name ~= 'dealership' and playerJob.name ~= 'cardealer') then
    cb({ ok = false, reason = 'not_dealership' })
    return
  end

  -- Get all vehicles from the vehicles table
  MySQL.query([[
    SELECT model, name, price, category, COALESCE(stock, 0) as stock
    FROM vehicles
    ORDER BY category, name
  ]], {}, function(rows)
    local vehicles = {}
    for _, row in ipairs(rows or {}) do
      table.insert(vehicles, {
        model = row.model,
        name = row.name or row.model,
        price = row.price or 0,
        category = row.category or 'Autres',
        stock = row.stock or 0
      })
    end
    cb({ ok = true, vehicles = vehicles })
  end)
end)

-- Get dealership stock (vehicles with stock > 0 from vehicles table)
ESX.RegisterServerCallback('mdt:server:getDealershipStock', function(source, cb)
  local playerJob = getPlayerJob(source)
  if not playerJob or (playerJob.name ~= 'dealership' and playerJob.name ~= 'cardealer') then
    cb({ ok = false, reason = 'not_dealership' })
    return
  end

  -- Get vehicles where stock > 0
  MySQL.query([[
    SELECT model, name, price, category, stock
    FROM vehicles
    WHERE stock > 0
    ORDER BY category, name
  ]], {}, function(rows)
    local stock = {}
    for _, row in ipairs(rows or {}) do
      table.insert(stock, {
        id = row.model, -- Use model as ID since we're using vehicles table
        model = row.model,
        name = row.name or row.model,
        price = row.price or 0,
        plate = '', -- No plate yet, generated on attribution
        stock = row.stock or 0
      })
    end
    cb({ ok = true, stock = stock })
  end)
end)

-- Get society money
ESX.RegisterServerCallback('mdt:server:getSocietyMoney', function(source, cb)
  local playerJob = getPlayerJob(source)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  TriggerEvent('esx_addonaccount:getSharedAccount', 'society_' .. playerJob.name, function(account)
    if account then
      cb({ ok = true, money = account.money })
    else
      -- Fallback: query directly
      MySQL.query('SELECT money FROM addon_account_data WHERE account_name = ?', { 'society_' .. playerJob.name }, function(rows)
        if rows and rows[1] then
          cb({ ok = true, money = rows[1].money or 0 })
        else
          cb({ ok = true, money = 0 })
        end
      end)
    end
  end)
end)

-- Order a vehicle (increment stock in vehicles table)
ESX.RegisterServerCallback('mdt:server:orderVehicle', function(source, cb, payload)
  local playerJob = getPlayerJob(source)
  if not playerJob or (playerJob.name ~= 'dealership' and playerJob.name ~= 'cardealer') then
    cb({ ok = false, reason = 'not_dealership' })
    return
  end

  if not payload or not payload.model or not payload.price then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local price = tonumber(payload.price) or 0
  local model = payload.model
  local name = payload.name or model

  -- Check society money and remove it
  TriggerEvent('esx_addonaccount:getSharedAccount', 'society_' .. playerJob.name, function(account)
    local processOrder = function()
      -- Increment stock in vehicles table
      MySQL.update('UPDATE vehicles SET stock = stock + 1 WHERE model = ?', { model }, function(affectedRows)
        if affectedRows > 0 then
          refreshClients('dealership')
          sendWebhook('Véhicule commandé', {
            { name = 'Concessionnaire', value = playerLabel(source), inline = true },
            { name = 'Véhicule', value = name, inline = true },
            { name = 'Modèle', value = model, inline = true },
            { name = 'Prix', value = tostring(price), inline = true }
          })
          cb({ ok = true })
        else
          cb({ ok = false, reason = 'vehicle_not_found' })
        end
      end)
    end

    if account then
      if account.money >= price then
        account.removeMoney(price)
        processOrder()
      else
        cb({ ok = false, reason = 'insufficient_funds' })
      end
    else
      -- Fallback: query directly
      MySQL.query('SELECT money FROM addon_account_data WHERE account_name = ?', { 'society_' .. playerJob.name }, function(rows)
        if not rows or not rows[1] or rows[1].money < price then
          cb({ ok = false, reason = 'insufficient_funds' })
          return
        end

        -- Remove money
        MySQL.update('UPDATE addon_account_data SET money = money - ? WHERE account_name = ?', { price, 'society_' .. playerJob.name })
        processOrder()
      end)
    end
  end)
end)

-- Assign a vehicle to a player (decrement stock and create owned_vehicle)
ESX.RegisterServerCallback('mdt:server:assignVehicle', function(source, cb, payload)
  local playerJob = getPlayerJob(source)
  if not playerJob or (playerJob.name ~= 'dealership' and playerJob.name ~= 'cardealer') then
    cb({ ok = false, reason = 'not_dealership' })
    return
  end

  -- vehicleId is now the model name
  if not payload or not payload.model then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local model = payload.model
  local targetPlayer = payload.targetPlayer

  -- Get target player identifier
  local targetIdentifier = nil
  local targetName = 'Client'

  if targetPlayer then
    local xTarget = ESX.GetPlayerFromId(targetPlayer)
    if xTarget then
      targetIdentifier = xTarget.identifier
      targetName = GetPlayerName(targetPlayer) or 'Client'
    end
  end

  if not targetIdentifier then
    cb({ ok = false, reason = 'no_target_player' })
    return
  end

  -- Check if stock > 0
  MySQL.query('SELECT stock, name FROM vehicles WHERE model = ?', { model }, function(rows)
    if not rows or #rows == 0 then
      cb({ ok = false, reason = 'vehicle_not_found' })
      return
    end

    local vehicleData = rows[1]
    if vehicleData.stock <= 0 then
      cb({ ok = false, reason = 'out_of_stock' })
      return
    end

    -- Decrement stock
    MySQL.update('UPDATE vehicles SET stock = stock - 1 WHERE model = ? AND stock > 0', { model }, function(affectedRows)
      if affectedRows == 0 then
        cb({ ok = false, reason = 'out_of_stock' })
        return
      end

      -- Generate random plate
      local plate = string.format('%s%s%04d',
        string.char(math.random(65, 90)),
        string.char(math.random(65, 90)),
        math.random(0, 9999)
      )

      -- Create vehicle data JSON for owned_vehicles
      local vehicleJson = json.encode({ model = model })

      -- Insert into owned_vehicles for the client
      MySQL.insert([[
        INSERT INTO owned_vehicles (owner, plate, vehicle, type, stored)
        VALUES (?, ?, ?, 'car', 0)
      ]], { targetIdentifier, plate, vehicleJson }, function()
        refreshClients('dealership')
        sendWebhook('Véhicule attribué', {
          { name = 'Concessionnaire', value = playerLabel(source), inline = true },
          { name = 'Client', value = targetName, inline = true },
          { name = 'Véhicule', value = vehicleData.name or model, inline = true },
          { name = 'Plaque', value = plate, inline = true }
        })
        cb({ ok = true, plate = plate })
      end)
    end)
  end)
end)
