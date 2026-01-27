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

-- Sync version - checks database for max grade
local function isBoss(playerId)
  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    return false
  end

  -- First check by grade name (fast path)
  local gradeName = string.lower(playerJob.gradeName or '')
  if gradeName == 'boss' or gradeName == 'patron' or gradeName == 'directeur' or gradeName == 'chef' then
    return true
  end

  -- Check database for max grade using sync query
  local result = MySQL.scalar.await('SELECT MAX(grade) FROM job_grades WHERE job_name = ?', { playerJob.name })
  if result ~= nil then
    return playerJob.grade >= result
  end

  return false
end

-- Async version that queries database for max grade (more accurate)
local function isBossAsync(playerId, callback)
  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    callback(false)
    return
  end

  -- Query database for max grade of this job
  MySQL.query('SELECT MAX(grade) as max_grade FROM job_grades WHERE job_name = ?', { playerJob.name }, function(rows)
    if rows and rows[1] and rows[1].max_grade ~= nil then
      local maxGrade = rows[1].max_grade
      -- Player is boss if they have the maximum grade
      callback(playerJob.grade >= maxGrade)
    else
      -- Fallback to grade_name check if no grades found
      local gradeName = string.lower(playerJob.gradeName or '')
      callback(gradeName == 'boss' or gradeName == 'patron' or gradeName == 'directeur' or gradeName == 'chef')
    end
  end)
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
      commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
      commission_due INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_mdt_employee_stats (job_name, employee_identifier)
    )
  ]])

  -- Fix column type if it was FLOAT before
  MySQL.query([[ALTER TABLE mdt_employee_stats MODIFY COLUMN commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0500]])

  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_doj_actions (
      id INT NOT NULL AUTO_INCREMENT,
      job_name VARCHAR(60) NOT NULL,
      action_type VARCHAR(40) NOT NULL,
      amount INT NOT NULL DEFAULT 0,
      reason VARCHAR(255) DEFAULT NULL,
      agent_identifier VARCHAR(60) DEFAULT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_mdt_doj_job (job_name),
      KEY idx_mdt_doj_type (action_type),
      KEY idx_mdt_doj_status (status)
    )
  ]])

  -- Code Penal: Articles de loi
  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_penal_code (
      id INT NOT NULL AUTO_INCREMENT,
      article_number VARCHAR(20) NOT NULL,
      category VARCHAR(60) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      min_fine INT NOT NULL DEFAULT 0,
      max_fine INT NOT NULL DEFAULT 0,
      min_jail INT NOT NULL DEFAULT 0,
      max_jail INT NOT NULL DEFAULT 0,
      points INT NOT NULL DEFAULT 0,
      status VARCHAR(40) NOT NULL DEFAULT 'draft',
      vote_status VARCHAR(40) NOT NULL DEFAULT 'pending',
      votes_for INT NOT NULL DEFAULT 0,
      votes_against INT NOT NULL DEFAULT 0,
      vote_deadline TIMESTAMP NULL DEFAULT NULL,
      created_by VARCHAR(60) DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      validated_at TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_article_number (article_number),
      KEY idx_penal_category (category),
      KEY idx_penal_status (status),
      KEY idx_penal_vote_status (vote_status)
    )
  ]])

  -- Votes des citoyens sur les lois
  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_penal_votes (
      id INT NOT NULL AUTO_INCREMENT,
      article_id INT NOT NULL,
      citizen_identifier VARCHAR(60) NOT NULL,
      citizen_name VARCHAR(120) NOT NULL,
      vote ENUM('for', 'against') NOT NULL,
      comment TEXT DEFAULT NULL,
      voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_citizen_vote (article_id, citizen_identifier),
      KEY idx_vote_article (article_id)
    )
  ]])

  -- Categories du code penal
  MySQL.query([[
    CREATE TABLE IF NOT EXISTS mdt_penal_categories (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(60) NOT NULL,
      label VARCHAR(120) NOT NULL,
      description VARCHAR(255) DEFAULT NULL,
      display_order INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_category_name (name)
    )
  ]])

  -- Insert default categories if empty
  MySQL.query('SELECT COUNT(*) as count FROM mdt_penal_categories', {}, function(rows)
    if rows and rows[1] and rows[1].count == 0 then
      MySQL.query([[
        INSERT INTO mdt_penal_categories (name, label, description, display_order) VALUES
        ('infractions', 'Infractions', 'Infractions mineures et contraventions', 1),
        ('delits', 'Delits', 'Delits et crimes mineurs', 2),
        ('crimes', 'Crimes', 'Crimes graves', 3),
        ('circulation', 'Code de la route', 'Infractions routieres', 4),
        ('economique', 'Crimes economiques', 'Fraude, blanchiment, evasion fiscale', 5)
      ]])
    end
  end)
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

local function giveInvoiceItem(playerId, payload, isDuplicate)
  if not exports.ox_inventory then
    return
  end

  local job = getPlayerJob(playerId)
  local metadata = {
    invoice_id = payload.invoiceId or ('INV-' .. os.time()),
    mode = payload.mode or 'vente',
    product = payload.product or 'Prestation',
    amount = payload.amount or 0,
    tax_rate = payload.taxRate or Config.Taxes.defaultRate,
    tax_amount = payload.taxAmount or 0,
    total = payload.total or 0,
    issuer = payload.issuer or GetPlayerName(playerId),
    job = job and job.name or 'unknown',
    created_at = os.date('%Y-%m-%d %H:%M:%S'),
    duplicate = isDuplicate and true or false,
    label = isDuplicate and 'DUPLICATA' or 'ORIGINAL'
  }

  exports.ox_inventory:AddItem(playerId, Config.InvoiceItem, 1, metadata)
end

-- Give receipt to both seller and buyer
local function giveReceiptsToBoth(sellerId, payload)
  -- Give original to seller
  giveInvoiceItem(sellerId, payload, false)

  -- Find buyer by identifier and give duplicate
  if payload.targetIdentifier then
    for _, xPlayer in pairs(ESX.GetPlayers()) do
      local p = ESX.GetPlayerFromId(xPlayer)
      if p and p.identifier == payload.targetIdentifier then
        giveInvoiceItem(xPlayer, payload, true)
        break
      end
    end
  end
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

    -- Check if player is boss by querying max grade from database
    MySQL.query('SELECT MAX(grade) as max_grade FROM job_grades WHERE job_name = ?', { job.name }, function(gradeRows)
      local isBossResult = false

      if gradeRows and gradeRows[1] and gradeRows[1].max_grade ~= nil then
        -- Player is boss if they have the maximum grade for their job
        isBossResult = job.grade >= gradeRows[1].max_grade
      else
        -- Fallback: check by grade name
        local gradeName = string.lower(job.grade_name or '')
        isBossResult = gradeName == 'boss' or gradeName == 'patron' or gradeName == 'directeur' or gradeName == 'chef'
      end

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
          isBoss = isBossResult
        }
      })
    end)
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
        ON stats.employee_identifier COLLATE utf8mb4_general_ci = users.identifier COLLATE utf8mb4_general_ci
        AND stats.job_name COLLATE utf8mb4_general_ci = users.job COLLATE utf8mb4_general_ci
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
  if not payload or not payload.identifier or payload.rate == nil then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  -- CRITICAL: Force convert to number and clamp between 0 and 1
  local rate = tonumber(payload.rate)
  if not rate then
    cb({ ok = false, reason = 'invalid_rate' })
    return
  end
  -- Ensure rate is between 0 and 1 (0% to 100%)
  if rate < 0 then rate = 0 end
  if rate > 1 then rate = 1 end

  -- Use string formatting to ensure proper decimal
  local rateStr = string.format("%.4f", rate)

  MySQL.update(
    [[
      INSERT INTO mdt_employee_stats (job_name, employee_identifier, commission_rate, invoices_count, sales_total, commission_due)
      VALUES (?, ?, ?, 0, 0, 0)
      ON DUPLICATE KEY UPDATE commission_rate = ?
    ]],
    { playerJob.name, payload.identifier, rateStr, rateStr },
    function()
      refreshClients('employees')
      sendWebhook('Commission modifiée', {
        { name = 'Patron', value = playerLabel(playerId), inline = true },
        { name = 'Employé', value = payload.identifier, inline = true },
        { name = 'Taux', value = tostring(rate * 100) .. '%', inline = true },
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

-- Delete a partnership
ESX.RegisterServerCallback('mdt:server:deletePartnership', function(source, cb, payload)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end
  if not payload or not payload.id then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  MySQL.update(
    'DELETE FROM mdt_partnerships WHERE id = ? AND job_name = ?',
    { payload.id, playerJob.name },
    function()
      refreshClients('partnerships')
      sendWebhook('Partenariat supprimé', {
        { name = 'Patron', value = playerLabel(playerId), inline = true },
        { name = 'Entreprise', value = playerJob.name, inline = true },
        { name = 'ID Partenariat', value = tostring(payload.id), inline = true }
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
      SELECT id, employee_name, employee_identifier, amount, status, created_at
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

-- Pay all pending commissions
ESX.RegisterServerCallback('mdt:server:payAllCommissions', function(source, cb)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  -- Get all employees with commission_due > 0
  MySQL.query([[
    SELECT
      users.identifier,
      users.firstname,
      users.lastname,
      stats.commission_due
    FROM users
    LEFT JOIN mdt_employee_stats stats
      ON stats.employee_identifier COLLATE utf8mb4_general_ci = users.identifier COLLATE utf8mb4_general_ci
      AND stats.job_name COLLATE utf8mb4_general_ci = users.job COLLATE utf8mb4_general_ci
    WHERE users.job = ? AND stats.commission_due > 0
  ]], { playerJob.name }, function(employees)
    if not employees or #employees == 0 then
      cb({ ok = true, paid = 0 })
      return
    end

    -- Calculate total needed
    local totalNeeded = 0
    for _, emp in ipairs(employees) do
      totalNeeded = totalNeeded + (emp.commission_due or 0)
    end

    -- Check society funds
    TriggerEvent('esx_addonaccount:getSharedAccount', 'society_' .. playerJob.name, function(account)
      local processPay = function(societyMoney)
        if societyMoney < totalNeeded then
          cb({ ok = false, reason = 'insufficient_funds', needed = totalNeeded, available = societyMoney })
          return
        end

        -- Pay each employee
        local paidCount = 0
        for _, emp in ipairs(employees) do
          local amount = emp.commission_due or 0
          local empName = string.format('%s %s', emp.firstname or '', emp.lastname or '')

          -- Find target player online
          local targetPlayer = nil
          for _, xPlayer in pairs(ESX.GetPlayers()) do
            local p = ESX.GetPlayerFromId(xPlayer)
            if p and p.identifier == emp.identifier then
              targetPlayer = p
              break
            end
          end

          if targetPlayer then
            targetPlayer.addAccountMoney('bank', amount, 'Commission payment')
          else
            MySQL.update('UPDATE users SET bank = bank + ? WHERE identifier = ?', { amount, emp.identifier })
          end

          -- Create payout record
          MySQL.insert('INSERT INTO mdt_commission_payouts (job_name, employee_identifier, employee_name, amount, status, paid_at) VALUES (?, ?, ?, ?, "paid", NOW())', { playerJob.name, emp.identifier, empName, amount })

          paidCount = paidCount + 1
        end

        -- Remove money from society
        if account then
          account.removeMoney(totalNeeded)
        else
          MySQL.update('UPDATE addon_account_data SET money = money - ? WHERE account_name = ?', { totalNeeded, 'society_' .. playerJob.name })
        end

        -- Reset all commission_due
        MySQL.update('UPDATE mdt_employee_stats SET commission_due = 0, invoices_count = 0, sales_total = 0 WHERE job_name = ? AND commission_due > 0', { playerJob.name })

        refreshClients('employees')
        refreshClients('commissions')
        sendWebhook('Toutes commissions payées', {
          { name = 'Patron', value = playerLabel(playerId), inline = true },
          { name = 'Employés payés', value = tostring(paidCount), inline = true },
          { name = 'Total payé', value = tostring(totalNeeded), inline = true }
        })
        cb({ ok = true, paid = paidCount, total = totalNeeded })
      end

      if account then
        processPay(account.money)
      else
        MySQL.query('SELECT money FROM addon_account_data WHERE account_name = ?', { 'society_' .. playerJob.name }, function(rows)
          processPay(rows and rows[1] and rows[1].money or 0)
        end)
      end
    end)
  end)
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
      payload.mode or 'vente',
      payload.product or 'Prestation',
      amount,
      taxRate,
      taxAmount,
      total,
      payload.status or 'pending',
      payload.taxFreeReason
    },
    function()
      -- Update employee stats (invoices count, sales total, commission due)
      local commissionRate = Config.Commissions and Config.Commissions.defaultRate or 0.05
      local commissionAmount = math.floor(total * commissionRate)

      MySQL.query('SELECT commission_rate FROM mdt_employee_stats WHERE job_name = ? AND employee_identifier = ?', { playerJob.name, playerJob.identifier }, function(statsRows)
        local rate = commissionRate
        if statsRows and statsRows[1] and statsRows[1].commission_rate then
          rate = statsRows[1].commission_rate
        end
        local commission = math.floor(total * rate)

        MySQL.query([[
          INSERT INTO mdt_employee_stats (job_name, employee_identifier, invoices_count, sales_total, commission_rate, commission_due)
          VALUES (?, ?, 1, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            invoices_count = invoices_count + 1,
            sales_total = sales_total + VALUES(sales_total),
            commission_due = commission_due + ?
        ]], { playerJob.name, playerJob.identifier, total, rate, commission, commission })
      end)

      if payload.giveItem then
        -- Give receipt to seller (original) and buyer (duplicate)
        giveReceiptsToBoth(source, payload)
      end
      refreshClients('invoices')
      refreshClients('employees')
      sendWebhook('Facture créée', {
        { name = 'Émetteur', value = playerLabel(source), inline = true },
        { name = 'Entreprise', value = playerJob.name, inline = true },
        { name = 'Mode', value = payload.mode or 'vente', inline = true },
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

  giveInvoiceItem(playerId, payload, false)
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
-- PRODUCTS SYSTEM
-- ============================================

-- Get products for a job
ESX.RegisterServerCallback('mdt:server:getProducts', function(source, cb)
  local playerJob = getPlayerJob(source)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  MySQL.query(
    'SELECT id, label, price, COALESCE(description, "") as description, COALESCE(status, "active") as status FROM mdt_products WHERE job_name = ? ORDER BY label',
    { playerJob.name },
    function(rows)
      cb({ ok = true, products = rows or {} })
    end
  )
end)

-- Save a product (create or update)
ESX.RegisterServerCallback('mdt:server:saveProduct', function(source, cb, payload)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  if not payload or not payload.label or not payload.price then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  if payload.id then
    -- Update existing product
    MySQL.update(
      'UPDATE mdt_products SET label = ?, price = ?, description = ?, status = ? WHERE id = ? AND job_name = ?',
      { payload.label, payload.price, payload.description or '', payload.status or 'active', payload.id, playerJob.name },
      function()
        refreshClients('products')
        sendWebhook('Produit modifié', {
          { name = 'Patron', value = playerLabel(playerId), inline = true },
          { name = 'Produit', value = payload.label, inline = true },
          { name = 'Prix', value = tostring(payload.price), inline = true },
          { name = 'Entreprise', value = playerJob.name, inline = true }
        })
        cb({ ok = true })
      end
    )
    return
  end

  -- Create new product
  MySQL.insert(
    'INSERT INTO mdt_products (job_name, label, price, description, status) VALUES (?, ?, ?, ?, ?)',
    { playerJob.name, payload.label, payload.price, payload.description or '', payload.status or 'active' },
    function(insertId)
      refreshClients('products')
      sendWebhook('Produit créé', {
        { name = 'Patron', value = playerLabel(playerId), inline = true },
        { name = 'Produit', value = payload.label, inline = true },
        { name = 'Prix', value = tostring(payload.price), inline = true },
        { name = 'Entreprise', value = playerJob.name, inline = true }
      })
      cb({ ok = true, id = insertId })
    end
  )
end)

-- Delete a product
ESX.RegisterServerCallback('mdt:server:deleteProduct', function(source, cb, payload)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  if not payload or not payload.id then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  MySQL.update(
    'DELETE FROM mdt_products WHERE id = ? AND job_name = ?',
    { payload.id, playerJob.name },
    function()
      refreshClients('products')
      cb({ ok = true })
    end
  )
end)

-- ============================================
-- PLAYER LOOKUP SYSTEM (for invoices)
-- ============================================

-- Get nearby players (for invoice target selection)
ESX.RegisterServerCallback('mdt:server:getNearbyPlayers', function(source, cb)
  local xPlayer = ESX.GetPlayerFromId(source)
  if not xPlayer then
    cb({ ok = false, reason = 'player_not_found' })
    return
  end

  local sourceCoords = GetEntityCoords(GetPlayerPed(source))
  local nearbyPlayers = {}
  local playersToCheck = {}

  for _, playerId in ipairs(GetPlayers()) do
    local targetId = tonumber(playerId)
    if targetId ~= source then
      local targetPed = GetPlayerPed(targetId)
      local targetCoords = GetEntityCoords(targetPed)
      local distance = #(sourceCoords - targetCoords)

      if distance < 10.0 then
        local targetPlayer = ESX.GetPlayerFromId(targetId)
        if targetPlayer then
          table.insert(playersToCheck, { id = targetId, identifier = targetPlayer.identifier })
        end
      end
    end
  end

  if #playersToCheck == 0 then
    cb({ ok = true, players = {} })
    return
  end

  local processed = 0
  for _, p in ipairs(playersToCheck) do
    MySQL.query('SELECT firstname, lastname FROM users WHERE identifier = ?', { p.identifier }, function(rows)
      local name = 'Inconnu'
      if rows and rows[1] then
        name = string.format('%s %s', rows[1].firstname or '', rows[1].lastname or '')
      end
      table.insert(nearbyPlayers, { id = p.id, name = name, identifier = p.identifier })
      processed = processed + 1
      if processed >= #playersToCheck then
        cb({ ok = true, players = nearbyPlayers })
      end
    end)
  end
end)

-- Get player by server ID
ESX.RegisterServerCallback('mdt:server:getPlayerById', function(source, cb, payload)
  if not payload or not payload.id then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local targetId = tonumber(payload.id)
  local targetPlayer = ESX.GetPlayerFromId(targetId)

  if not targetPlayer then
    cb({ ok = false, reason = 'player_not_found' })
    return
  end

  MySQL.query('SELECT firstname, lastname FROM users WHERE identifier = ?', { targetPlayer.identifier }, function(rows)
    local name = 'Inconnu'
    if rows and rows[1] then
      name = string.format('%s %s', rows[1].firstname or '', rows[1].lastname or '')
    end

    cb({
      ok = true,
      player = { id = targetId, name = name, identifier = targetPlayer.identifier }
    })
  end)
end)

-- ============================================
-- EMPLOYEE MANAGEMENT (Hire, Fire, Promote, Pay)
-- ============================================

-- Pay commission to an employee
ESX.RegisterServerCallback('mdt:server:payEmployeeCommission', function(source, cb, payload)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  if not payload or not payload.identifier or not payload.amount then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  local amount = tonumber(payload.amount) or 0
  if amount <= 0 then
    cb({ ok = false, reason = 'invalid_amount' })
    return
  end

  TriggerEvent('esx_addonaccount:getSharedAccount', 'society_' .. playerJob.name, function(account)
    local processPay = function(societyMoney)
      if societyMoney < amount then
        cb({ ok = false, reason = 'insufficient_funds' })
        return
      end

      -- Find target player online
      local targetPlayer = nil
      for _, xPlayer in pairs(ESX.GetPlayers()) do
        local p = ESX.GetPlayerFromId(xPlayer)
        if p and p.identifier == payload.identifier then
          targetPlayer = p
          break
        end
      end

      if targetPlayer then
        targetPlayer.addAccountMoney('bank', amount, 'Commission payment')
      else
        MySQL.update('UPDATE users SET bank = bank + ? WHERE identifier = ?', { amount, payload.identifier })
      end

      if account then
        account.removeMoney(amount)
      else
        MySQL.update('UPDATE addon_account_data SET money = money - ? WHERE account_name = ?', { amount, 'society_' .. playerJob.name })
      end

      MySQL.update('UPDATE mdt_employee_stats SET commission_due = 0, invoices_count = 0, sales_total = 0 WHERE job_name = ? AND employee_identifier = ?', { playerJob.name, payload.identifier })

      MySQL.insert('INSERT INTO mdt_commission_payouts (job_name, employee_identifier, employee_name, amount, status, paid_at) VALUES (?, ?, ?, ?, "paid", NOW())', { playerJob.name, payload.identifier, payload.employeeName or 'Employe', amount })

      refreshClients('employees')
      refreshClients('commissions')
      sendWebhook('Commission payée', {
        { name = 'Patron', value = playerLabel(playerId), inline = true },
        { name = 'Employé', value = payload.employeeName or payload.identifier, inline = true },
        { name = 'Montant', value = tostring(amount), inline = true }
      })
      cb({ ok = true })
    end

    if account then
      processPay(account.money)
    else
      MySQL.query('SELECT money FROM addon_account_data WHERE account_name = ?', { 'society_' .. playerJob.name }, function(rows)
        processPay(rows and rows[1] and rows[1].money or 0)
      end)
    end
  end)
end)

-- Hire employee by server ID
ESX.RegisterServerCallback('mdt:server:hireEmployeeById', function(source, cb, payload)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  if not payload or not payload.targetId then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local bossJob = getPlayerJob(playerId)
  local target = ESX.GetPlayerFromId(payload.targetId)
  if not bossJob or not target then
    cb({ ok = false, reason = 'invalid_target' })
    return
  end

  target.setJob(bossJob.name, 0)
  sendWebhook('Employé recruté', {
    { name = 'Patron', value = playerLabel(playerId), inline = true },
    { name = 'Employé', value = playerLabel(payload.targetId), inline = true },
    { name = 'Entreprise', value = bossJob.name, inline = true }
  })
  cb({ ok = true })
end)

-- Fire employee by identifier
ESX.RegisterServerCallback('mdt:server:fireEmployeeByIdentifier', function(source, cb, payload)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  if not payload or not payload.identifier then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local bossJob = getPlayerJob(playerId)
  if not bossJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  local targetPlayer = nil
  for _, xPlayer in pairs(ESX.GetPlayers()) do
    local p = ESX.GetPlayerFromId(xPlayer)
    if p and p.identifier == payload.identifier then
      targetPlayer = p
      break
    end
  end

  if targetPlayer then
    targetPlayer.setJob(Config.DefaultJob, 0)
  else
    MySQL.update('UPDATE users SET job = ?, job_grade = 0 WHERE identifier = ?', { Config.DefaultJob, payload.identifier })
  end

  sendWebhook('Employé licencié', {
    { name = 'Patron', value = playerLabel(playerId), inline = true },
    { name = 'Employé', value = payload.identifier, inline = true }
  })
  cb({ ok = true })
end)

-- Promote employee by identifier
ESX.RegisterServerCallback('mdt:server:promoteEmployeeByIdentifier', function(source, cb, payload)
  local playerId = source
  if not isBoss(playerId) then
    cb({ ok = false, reason = 'no_permission' })
    return
  end

  if not payload or not payload.identifier or payload.newGrade == nil then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local bossJob = getPlayerJob(playerId)
  if not bossJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  local newGrade = tonumber(payload.newGrade) or 0

  local targetPlayer = nil
  for _, xPlayer in pairs(ESX.GetPlayers()) do
    local p = ESX.GetPlayerFromId(xPlayer)
    if p and p.identifier == payload.identifier then
      targetPlayer = p
      break
    end
  end

  if targetPlayer then
    targetPlayer.setJob(bossJob.name, newGrade)
  else
    MySQL.update('UPDATE users SET job_grade = ? WHERE identifier = ? AND job = ?', { newGrade, payload.identifier, bossJob.name })
  end

  sendWebhook('Employé promu', {
    { name = 'Patron', value = playerLabel(playerId), inline = true },
    { name = 'Employé', value = payload.identifier, inline = true },
    { name = 'Nouveau grade', value = tostring(newGrade), inline = true }
  })
  cb({ ok = true })
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

-- ============================================
-- DOJ SYSTEM (Department of Justice)
-- ============================================

-- Check if player is DOJ
local function isDoj(playerId)
  local playerJob = getPlayerJob(playerId)
  if not playerJob then return false end
  return playerJob.name == 'doj'
end

-- Get all societies for DOJ
ESX.RegisterServerCallback('mdt:server:getAllSocieties', function(source, cb)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  -- Get societies from addon_account_data
  MySQL.query([[
    SELECT
      REPLACE(account_name, 'society_', '') as job_name,
      money
    FROM addon_account_data
    WHERE account_name LIKE 'society_%'
    ORDER BY money DESC
  ]], {}, function(accountRows)
    local societies = {}

    for _, row in ipairs(accountRows or {}) do
      local jobName = row.job_name

      -- Get job label from jobs table
      MySQL.query('SELECT label FROM jobs WHERE name = ?', { jobName }, function(jobRows)
        local label = jobRows and jobRows[1] and jobRows[1].label or jobName

        -- Get tax stats for this society
        MySQL.query([[
          SELECT
            COALESCE(SUM(tax_amount), 0) as taxes_generated,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN tax_amount ELSE 0 END), 0) as taxes_pending,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN tax_amount ELSE 0 END), 0) as taxes_paid,
            COUNT(*) as invoice_count
          FROM mdt_invoices
          WHERE job_name = ?
        ]], { jobName }, function(taxRows)
          local taxData = taxRows and taxRows[1] or {}

          -- Check if frozen
          MySQL.query('SELECT * FROM mdt_doj_actions WHERE job_name = ? AND action_type = "freeze" AND status = "active"', { jobName }, function(freezeRows)
            local isFrozen = freezeRows and #freezeRows > 0

            table.insert(societies, {
              job_name = jobName,
              label = label,
              money = row.money or 0,
              taxes_generated = taxData.taxes_generated or 0,
              taxes_pending = taxData.taxes_pending or 0,
              taxes_paid = taxData.taxes_paid or 0,
              invoice_count = taxData.invoice_count or 0,
              is_frozen = isFrozen
            })

            -- Once all processed, send callback
            if #societies == #accountRows then
              cb({ ok = true, societies = societies })
            end
          end)
        end)
      end)
    end

    -- If no societies found
    if #accountRows == 0 then
      cb({ ok = true, societies = {} })
    end
  end)
end)

-- Get DOJ stats
ESX.RegisterServerCallback('mdt:server:getDojStats', function(source, cb)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  local stats = {
    totalTaxesGenerated = 0,
    totalTaxesPending = 0,
    totalTaxesPaid = 0,
    societiesCount = 0,
    frozenCount = 0,
    activeFines = 0,
    dojBalance = 0
  }

  -- Get total taxes
  MySQL.query([[
    SELECT
      COALESCE(SUM(tax_amount), 0) as total_taxes,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN tax_amount ELSE 0 END), 0) as pending_taxes,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN tax_amount ELSE 0 END), 0) as paid_taxes
    FROM mdt_invoices
  ]], {}, function(taxRows)
    if taxRows and taxRows[1] then
      stats.totalTaxesGenerated = taxRows[1].total_taxes or 0
      stats.totalTaxesPending = taxRows[1].pending_taxes or 0
      stats.totalTaxesPaid = taxRows[1].paid_taxes or 0
    end

    -- Get societies count
    MySQL.query('SELECT COUNT(*) as count FROM addon_account_data WHERE account_name LIKE "society_%"', {}, function(societyRows)
      if societyRows and societyRows[1] then
        stats.societiesCount = societyRows[1].count or 0
      end

      -- Get frozen count
      MySQL.query('SELECT COUNT(DISTINCT job_name) as count FROM mdt_doj_actions WHERE action_type = "freeze" AND status = "active"', {}, function(frozenRows)
        if frozenRows and frozenRows[1] then
          stats.frozenCount = frozenRows[1].count or 0
        end

        -- Get active fines
        MySQL.query('SELECT COALESCE(SUM(amount), 0) as total FROM mdt_doj_actions WHERE action_type = "fine" AND status = "pending"', {}, function(fineRows)
          if fineRows and fineRows[1] then
            stats.activeFines = fineRows[1].total or 0
          end

          -- Get DOJ balance
          TriggerEvent('esx_addonaccount:getSharedAccount', 'society_doj', function(account)
            if account then
              stats.dojBalance = account.money
            end
            cb({ ok = true, stats = stats })
          end)
        end)
      end)
    end)
  end)
end)

-- Fine a company (Amende)
ESX.RegisterServerCallback('mdt:server:fineCompany', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.job_name or not payload.amount or not payload.reason then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local amount = tonumber(payload.amount) or 0
  if amount <= 0 then
    cb({ ok = false, reason = 'invalid_amount' })
    return
  end

  -- Record the fine
  MySQL.insert([[
    INSERT INTO mdt_doj_actions (job_name, action_type, amount, reason, agent_identifier, status)
    VALUES (?, 'fine', ?, ?, ?, 'pending')
  ]], { payload.job_name, amount, payload.reason, getPlayerJob(source).identifier or 'unknown' }, function()
    refreshClients('doj')
    sendWebhook('Amende DOJ', {
      { name = 'Agent DOJ', value = playerLabel(source), inline = true },
      { name = 'Entreprise', value = payload.job_name, inline = true },
      { name = 'Montant', value = tostring(amount), inline = true },
      { name = 'Raison', value = payload.reason, inline = false }
    })
    cb({ ok = true })
  end)
end)

-- Freeze a company
ESX.RegisterServerCallback('mdt:server:freezeCompany', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.job_name or not payload.reason then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  -- Check if already frozen
  MySQL.query('SELECT * FROM mdt_doj_actions WHERE job_name = ? AND action_type = "freeze" AND status = "active"', { payload.job_name }, function(rows)
    if rows and #rows > 0 then
      cb({ ok = false, reason = 'already_frozen' })
      return
    end

    -- Record the freeze
    MySQL.insert([[
      INSERT INTO mdt_doj_actions (job_name, action_type, reason, agent_identifier, status)
      VALUES (?, 'freeze', ?, ?, 'active')
    ]], { payload.job_name, payload.reason, getPlayerJob(source).identifier or 'unknown' }, function()
      refreshClients('doj')
      sendWebhook('Gel Entreprise DOJ', {
        { name = 'Agent DOJ', value = playerLabel(source), inline = true },
        { name = 'Entreprise', value = payload.job_name, inline = true },
        { name = 'Raison', value = payload.reason, inline = false }
      })
      cb({ ok = true })
    end)
  end)
end)

-- Unfreeze a company
ESX.RegisterServerCallback('mdt:server:unfreezeCompany', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.job_name then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  MySQL.update('UPDATE mdt_doj_actions SET status = "resolved" WHERE job_name = ? AND action_type = "freeze" AND status = "active"', { payload.job_name }, function()
    refreshClients('doj')
    sendWebhook('Degel Entreprise DOJ', {
      { name = 'Agent DOJ', value = playerLabel(source), inline = true },
      { name = 'Entreprise', value = payload.job_name, inline = true }
    })
    cb({ ok = true })
  end)
end)

-- Force audit on a company
ESX.RegisterServerCallback('mdt:server:forceAudit', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.job_name then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  -- Record the audit
  MySQL.insert([[
    INSERT INTO mdt_doj_actions (job_name, action_type, reason, agent_identifier, status)
    VALUES (?, 'audit', ?, ?, 'active')
  ]], { payload.job_name, payload.reason or 'Audit force', getPlayerJob(source).identifier or 'unknown' }, function()
    refreshClients('doj')
    sendWebhook('Audit Force DOJ', {
      { name = 'Agent DOJ', value = playerLabel(source), inline = true },
      { name = 'Entreprise', value = payload.job_name, inline = true }
    })
    cb({ ok = true })
  end)
end)

-- Force payment of taxes
ESX.RegisterServerCallback('mdt:server:forcePayment', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.job_name then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  -- Get pending taxes for this company
  MySQL.query([[
    SELECT COALESCE(SUM(tax_amount), 0) as pending_taxes
    FROM mdt_invoices
    WHERE job_name = ? AND status = 'pending'
  ]], { payload.job_name }, function(rows)
    local pendingTaxes = rows and rows[1] and rows[1].pending_taxes or 0

    if pendingTaxes <= 0 then
      cb({ ok = false, reason = 'no_pending_taxes' })
      return
    end

    -- Get society balance
    TriggerEvent('esx_addonaccount:getSharedAccount', 'society_' .. payload.job_name, function(account)
      local processPayment = function(societyMoney)
        if societyMoney < pendingTaxes then
          cb({ ok = false, reason = 'insufficient_funds', needed = pendingTaxes, available = societyMoney })
          return
        end

        -- Remove from society
        if account then
          account.removeMoney(pendingTaxes)
        else
          MySQL.update('UPDATE addon_account_data SET money = money - ? WHERE account_name = ?', { pendingTaxes, 'society_' .. payload.job_name })
        end

        -- Add to DOJ
        TriggerEvent('esx_addonaccount:getSharedAccount', 'society_doj', function(dojAccount)
          if dojAccount then
            dojAccount.addMoney(pendingTaxes)
          else
            MySQL.update('UPDATE addon_account_data SET money = money + ? WHERE account_name = ?', { pendingTaxes, 'society_doj' })
          end
        end)

        -- Mark invoices as paid
        MySQL.update('UPDATE mdt_invoices SET status = "paid", paid_at = NOW() WHERE job_name = ? AND status = "pending"', { payload.job_name })

        -- Record the action
        MySQL.insert([[
          INSERT INTO mdt_doj_actions (job_name, action_type, amount, reason, agent_identifier, status)
          VALUES (?, 'force_payment', ?, 'Paiement force par DOJ', ?, 'completed')
        ]], { payload.job_name, pendingTaxes, getPlayerJob(source).identifier or 'unknown' })

        refreshClients('doj')
        refreshClients('invoices')
        sendWebhook('Paiement Force DOJ', {
          { name = 'Agent DOJ', value = playerLabel(source), inline = true },
          { name = 'Entreprise', value = payload.job_name, inline = true },
          { name = 'Montant', value = tostring(pendingTaxes), inline = true }
        })
        cb({ ok = true, amount = pendingTaxes })
      end

      if account then
        processPayment(account.money)
      else
        MySQL.query('SELECT money FROM addon_account_data WHERE account_name = ?', { 'society_' .. payload.job_name }, function(accountRows)
          processPayment(accountRows and accountRows[1] and accountRows[1].money or 0)
        end)
      end
    end)
  end)
end)

-- Export company data (for backup/audit)
ESX.RegisterServerCallback('mdt:server:exportCompanyData', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.job_name then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local jobName = payload.job_name
  local exportData = {
    job_name = jobName,
    exported_at = os.date('%Y-%m-%d %H:%M:%S'),
    exported_by = playerLabel(source)
  }

  -- Get society balance
  MySQL.query('SELECT money FROM addon_account_data WHERE account_name = ?', { 'society_' .. jobName }, function(accountRows)
    exportData.balance = accountRows and accountRows[1] and accountRows[1].money or 0

    -- Get employees
    MySQL.query('SELECT identifier, firstname, lastname, job_grade FROM users WHERE job = ?', { jobName }, function(empRows)
      exportData.employees = empRows or {}

      -- Get invoices
      MySQL.query([[
        SELECT invoice_id, issuer_name, target_name, mode, product_label, amount_ht, tax_amount, total_ttc, status, created_at
        FROM mdt_invoices
        WHERE job_name = ?
        ORDER BY created_at DESC
        LIMIT 500
      ]], { jobName }, function(invRows)
        exportData.invoices = invRows or {}

        -- Get DOJ actions
        MySQL.query([[
          SELECT action_type, amount, reason, status, created_at
          FROM mdt_doj_actions
          WHERE job_name = ?
          ORDER BY created_at DESC
        ]], { jobName }, function(actRows)
          exportData.doj_actions = actRows or {}

          -- Get partnerships
          MySQL.query('SELECT partner_name, discount_rate, status, notes FROM mdt_partnerships WHERE job_name = ?', { jobName }, function(partRows)
            exportData.partnerships = partRows or {}

            -- Record the export
            MySQL.insert([[
              INSERT INTO mdt_doj_actions (job_name, action_type, reason, agent_identifier, status)
              VALUES (?, 'export', 'Export des donnees entreprise', ?, 'completed')
            ]], { jobName, getPlayerJob(source).identifier or 'unknown' })

            sendWebhook('Export Donnees DOJ', {
              { name = 'Agent DOJ', value = playerLabel(source), inline = true },
              { name = 'Entreprise', value = jobName, inline = true }
            })

            cb({ ok = true, data = exportData })
          end)
        end)
      end)
    end)
  end)
end)

-- Get DOJ action history for a company
ESX.RegisterServerCallback('mdt:server:getCompanyDojHistory', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.job_name then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  MySQL.query([[
    SELECT id, action_type, amount, reason, agent_identifier, status, created_at
    FROM mdt_doj_actions
    WHERE job_name = ?
    ORDER BY created_at DESC
    LIMIT 100
  ]], { payload.job_name }, function(rows)
    cb({ ok = true, history = rows or {} })
  end)
end)

-- ============================================
-- PENAL CODE SYSTEM (Code Penal)
-- ============================================

-- Get all penal code categories
ESX.RegisterServerCallback('mdt:server:getPenalCategories', function(source, cb)
  MySQL.query('SELECT * FROM mdt_penal_categories ORDER BY display_order', {}, function(rows)
    cb({ ok = true, categories = rows or {} })
  end)
end)

-- Get all penal code articles (for DOJ - all statuses)
ESX.RegisterServerCallback('mdt:server:getPenalArticles', function(source, cb, payload)
  local isDojAgent = isDoj(source)
  local category = payload and payload.category or nil
  local status = payload and payload.status or nil

  local query = 'SELECT * FROM mdt_penal_code WHERE 1=1'
  local params = {}

  -- Citizens only see validated articles
  if not isDojAgent then
    query = query .. ' AND status = "active"'
  end

  if category then
    query = query .. ' AND category = ?'
    table.insert(params, category)
  end

  if status and isDojAgent then
    query = query .. ' AND vote_status = ?'
    table.insert(params, status)
  end

  query = query .. ' ORDER BY category, article_number'

  MySQL.query(query, params, function(rows)
    cb({ ok = true, articles = rows or {}, isDoj = isDojAgent })
  end)
end)

-- Get single article with vote details
ESX.RegisterServerCallback('mdt:server:getPenalArticle', function(source, cb, payload)
  if not payload or not payload.id then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  MySQL.query('SELECT * FROM mdt_penal_code WHERE id = ?', { payload.id }, function(rows)
    if not rows or #rows == 0 then
      cb({ ok = false, reason = 'not_found' })
      return
    end

    local article = rows[1]

    -- Get votes for this article
    MySQL.query('SELECT * FROM mdt_penal_votes WHERE article_id = ? ORDER BY voted_at DESC', { payload.id }, function(voteRows)
      article.votes = voteRows or {}

      -- Check if current player has voted
      local xPlayer = ESX.GetPlayerFromId(source)
      if xPlayer then
        MySQL.query('SELECT vote FROM mdt_penal_votes WHERE article_id = ? AND citizen_identifier = ?', { payload.id, xPlayer.identifier }, function(myVote)
          article.myVote = myVote and myVote[1] and myVote[1].vote or nil
          cb({ ok = true, article = article })
        end)
      else
        cb({ ok = true, article = article })
      end
    end)
  end)
end)

-- Create new penal article (DOJ only)
ESX.RegisterServerCallback('mdt:server:createPenalArticle', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.article_number or not payload.title or not payload.description or not payload.category then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local playerJob = getPlayerJob(source)

  -- Calculate vote deadline (default 7 days)
  local voteDays = payload.vote_days or 7
  local deadline = os.date('%Y-%m-%d %H:%M:%S', os.time() + (voteDays * 24 * 60 * 60))

  MySQL.insert([[
    INSERT INTO mdt_penal_code
      (article_number, category, title, description, min_fine, max_fine, min_jail, max_jail, points, status, vote_status, vote_deadline, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'voting', ?, ?)
  ]], {
    payload.article_number,
    payload.category,
    payload.title,
    payload.description,
    payload.min_fine or 0,
    payload.max_fine or 0,
    payload.min_jail or 0,
    payload.max_jail or 0,
    payload.points or 0,
    deadline,
    playerJob and playerJob.identifier or 'unknown'
  }, function(insertId)
    refreshClients('penal')
    sendWebhook('Article Code Penal cree', {
      { name = 'Agent DOJ', value = playerLabel(source), inline = true },
      { name = 'Article', value = payload.article_number, inline = true },
      { name = 'Titre', value = payload.title, inline = true },
      { name = 'Delai vote', value = voteDays .. ' jours', inline = true }
    })
    cb({ ok = true, id = insertId })
  end)
end)

-- Update penal article (DOJ only)
ESX.RegisterServerCallback('mdt:server:updatePenalArticle', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.id then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  MySQL.update([[
    UPDATE mdt_penal_code SET
      article_number = ?,
      category = ?,
      title = ?,
      description = ?,
      min_fine = ?,
      max_fine = ?,
      min_jail = ?,
      max_jail = ?,
      points = ?
    WHERE id = ?
  ]], {
    payload.article_number,
    payload.category,
    payload.title,
    payload.description,
    payload.min_fine or 0,
    payload.max_fine or 0,
    payload.min_jail or 0,
    payload.max_jail or 0,
    payload.points or 0,
    payload.id
  }, function()
    refreshClients('penal')
    cb({ ok = true })
  end)
end)

-- Delete penal article (DOJ only, only if draft)
ESX.RegisterServerCallback('mdt:server:deletePenalArticle', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.id then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  -- Only allow deletion of draft articles
  MySQL.query('SELECT status FROM mdt_penal_code WHERE id = ?', { payload.id }, function(rows)
    if not rows or #rows == 0 then
      cb({ ok = false, reason = 'not_found' })
      return
    end

    if rows[1].status == 'active' then
      cb({ ok = false, reason = 'cannot_delete_active' })
      return
    end

    -- Delete votes first
    MySQL.update('DELETE FROM mdt_penal_votes WHERE article_id = ?', { payload.id })

    -- Delete article
    MySQL.update('DELETE FROM mdt_penal_code WHERE id = ?', { payload.id }, function()
      refreshClients('penal')
      cb({ ok = true })
    end)
  end)
end)

-- Vote on a penal article (any citizen)
ESX.RegisterServerCallback('mdt:server:voteOnArticle', function(source, cb, payload)
  local xPlayer = ESX.GetPlayerFromId(source)
  if not xPlayer then
    cb({ ok = false, reason = 'player_not_found' })
    return
  end

  if not payload or not payload.article_id or not payload.vote then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  if payload.vote ~= 'for' and payload.vote ~= 'against' then
    cb({ ok = false, reason = 'invalid_vote' })
    return
  end

  -- Check if article exists and is open for voting
  MySQL.query('SELECT * FROM mdt_penal_code WHERE id = ? AND vote_status = "voting"', { payload.article_id }, function(rows)
    if not rows or #rows == 0 then
      cb({ ok = false, reason = 'article_not_votable' })
      return
    end

    local article = rows[1]

    -- Check deadline
    if article.vote_deadline then
      local deadline = article.vote_deadline
      local now = os.date('%Y-%m-%d %H:%M:%S')
      if now > deadline then
        cb({ ok = false, reason = 'vote_expired' })
        return
      end
    end

    -- Get citizen name
    MySQL.query('SELECT firstname, lastname FROM users WHERE identifier = ?', { xPlayer.identifier }, function(userRows)
      local citizenName = 'Citoyen'
      if userRows and userRows[1] then
        citizenName = string.format('%s %s', userRows[1].firstname or '', userRows[1].lastname or '')
      end

      -- Check if already voted
      MySQL.query('SELECT id, vote FROM mdt_penal_votes WHERE article_id = ? AND citizen_identifier = ?', { payload.article_id, xPlayer.identifier }, function(voteRows)
        if voteRows and #voteRows > 0 then
          -- Update existing vote
          local oldVote = voteRows[1].vote
          MySQL.update('UPDATE mdt_penal_votes SET vote = ?, comment = ?, voted_at = NOW() WHERE id = ?', {
            payload.vote,
            payload.comment or nil,
            voteRows[1].id
          }, function()
            -- Update vote counts
            if oldVote ~= payload.vote then
              if payload.vote == 'for' then
                MySQL.update('UPDATE mdt_penal_code SET votes_for = votes_for + 1, votes_against = votes_against - 1 WHERE id = ?', { payload.article_id })
              else
                MySQL.update('UPDATE mdt_penal_code SET votes_for = votes_for - 1, votes_against = votes_against + 1 WHERE id = ?', { payload.article_id })
              end
            end
            refreshClients('penal')
            cb({ ok = true, updated = true })
          end)
        else
          -- Insert new vote
          MySQL.insert('INSERT INTO mdt_penal_votes (article_id, citizen_identifier, citizen_name, vote, comment) VALUES (?, ?, ?, ?, ?)', {
            payload.article_id,
            xPlayer.identifier,
            citizenName,
            payload.vote,
            payload.comment or nil
          }, function()
            -- Update vote counts
            if payload.vote == 'for' then
              MySQL.update('UPDATE mdt_penal_code SET votes_for = votes_for + 1 WHERE id = ?', { payload.article_id })
            else
              MySQL.update('UPDATE mdt_penal_code SET votes_against = votes_against + 1 WHERE id = ?', { payload.article_id })
            end
            refreshClients('penal')
            cb({ ok = true })
          end)
        end
      end)
    end)
  end)
end)

-- Validate article (DOJ only - approve after voting)
ESX.RegisterServerCallback('mdt:server:validatePenalArticle', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.id then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  MySQL.update([[
    UPDATE mdt_penal_code SET
      status = 'active',
      vote_status = 'approved',
      validated_at = NOW()
    WHERE id = ?
  ]], { payload.id }, function()
    refreshClients('penal')
    sendWebhook('Article Code Penal valide', {
      { name = 'Agent DOJ', value = playerLabel(source), inline = true },
      { name = 'Article ID', value = tostring(payload.id), inline = true }
    })
    cb({ ok = true })
  end)
end)

-- Reject article (DOJ only)
ESX.RegisterServerCallback('mdt:server:rejectPenalArticle', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.id then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  MySQL.update([[
    UPDATE mdt_penal_code SET
      status = 'rejected',
      vote_status = 'rejected'
    WHERE id = ?
  ]], { payload.id }, function()
    refreshClients('penal')
    cb({ ok = true })
  end)
end)

-- Extend voting deadline (DOJ only)
ESX.RegisterServerCallback('mdt:server:extendVoteDeadline', function(source, cb, payload)
  if not isDoj(source) then
    cb({ ok = false, reason = 'not_doj' })
    return
  end

  if not payload or not payload.id or not payload.days then
    cb({ ok = false, reason = 'invalid_payload' })
    return
  end

  local extraDays = tonumber(payload.days) or 7
  MySQL.update([[
    UPDATE mdt_penal_code SET
      vote_deadline = DATE_ADD(vote_deadline, INTERVAL ? DAY)
    WHERE id = ?
  ]], { extraDays, payload.id }, function()
    refreshClients('penal')
    cb({ ok = true })
  end)
end)

-- Get voting stats for DOJ dashboard
ESX.RegisterServerCallback('mdt:server:getPenalStats', function(source, cb)
  local stats = {
    totalArticles = 0,
    activeArticles = 0,
    votingArticles = 0,
    totalVotes = 0
  }

  MySQL.query('SELECT COUNT(*) as total FROM mdt_penal_code', {}, function(rows)
    stats.totalArticles = rows and rows[1] and rows[1].total or 0

    MySQL.query('SELECT COUNT(*) as active FROM mdt_penal_code WHERE status = "active"', {}, function(rows2)
      stats.activeArticles = rows2 and rows2[1] and rows2[1].active or 0

      MySQL.query('SELECT COUNT(*) as voting FROM mdt_penal_code WHERE vote_status = "voting"', {}, function(rows3)
        stats.votingArticles = rows3 and rows3[1] and rows3[1].voting or 0

        MySQL.query('SELECT COUNT(*) as votes FROM mdt_penal_votes', {}, function(rows4)
          stats.totalVotes = rows4 and rows4[1] and rows4[1].votes or 0
          cb({ ok = true, stats = stats })
        end)
      end)
    end)
  end)
end)

-- Get company data for Gestion Societe page
ESX.RegisterServerCallback('mdt:server:getCompanyData', function(source, cb)
  local playerId = source
  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  local companyData = {
    societyMoney = 0,
    totalCommissionsDue = 0,
    totalTaxesDue = 0,
    employeesCount = 0,
    pendingInvoices = 0
  }

  -- Get society money
  TriggerEvent('esx_addonaccount:getSharedAccount', 'society_' .. playerJob.name, function(account)
    local getSocietyMoney = function(money)
      companyData.societyMoney = money or 0

      -- Get total commissions due
      MySQL.query('SELECT COALESCE(SUM(commission_due), 0) as total FROM mdt_employee_stats WHERE job_name = ?', { playerJob.name }, function(commRows)
        companyData.totalCommissionsDue = commRows and commRows[1] and commRows[1].total or 0

        -- Get total taxes due (from unpaid invoices)
        MySQL.query('SELECT COALESCE(SUM(tax_amount), 0) as total FROM mdt_invoices WHERE job_name = ? AND status = "paid"', { playerJob.name }, function(taxRows)
          companyData.totalTaxesDue = taxRows and taxRows[1] and taxRows[1].total or 0

          -- Get employees count
          MySQL.query('SELECT COUNT(*) as count FROM users WHERE job = ?', { playerJob.name }, function(empRows)
            companyData.employeesCount = empRows and empRows[1] and empRows[1].count or 0

            -- Get pending invoices count
            MySQL.query('SELECT COUNT(*) as count FROM mdt_invoices WHERE job_name = ? AND status = "pending"', { playerJob.name }, function(invRows)
              companyData.pendingInvoices = invRows and invRows[1] and invRows[1].count or 0

              cb({ ok = true, data = companyData })
            end)
          end)
        end)
      end)
    end

    if account then
      getSocietyMoney(account.money)
    else
      MySQL.query('SELECT money FROM addon_account_data WHERE account_name = ?', { 'society_' .. playerJob.name }, function(rows)
        getSocietyMoney(rows and rows[1] and rows[1].money or 0)
      end)
    end
  end)
end)

-- Reset company stats (all employee stats)
ESX.RegisterServerCallback('mdt:server:resetCompanyStats', function(source, cb)
  local playerId = source
  local playerJob = getPlayerJob(playerId)
  if not playerJob then
    cb({ ok = false, reason = 'no_job' })
    return
  end

  -- Use async boss check for accurate permission
  isBossAsync(playerId, function(isBossResult)
    if not isBossResult then
      cb({ ok = false, reason = 'no_permission' })
      return
    end

    -- Reset all employee stats for this company
    MySQL.update('UPDATE mdt_employee_stats SET invoices_count = 0, sales_total = 0, commission_due = 0 WHERE job_name = ?', { playerJob.name }, function()
      refreshClients('employees')
      refreshClients('company')
      sendWebhook('Reset statistiques societe', {
        { name = 'Patron', value = playerLabel(playerId), inline = true },
        { name = 'Entreprise', value = playerJob.name, inline = true }
      })
      cb({ ok = true })
    end)
  end)
end)
