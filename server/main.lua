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

RegisterNetEvent('mdt:server:ready', function()
  local playerId = source
  TriggerClientEvent('mdt:client:ready', playerId, {
    resource = resourceName
  })
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
  TriggerClientEvent('mdt:client:taxRateUpdated', -1, rate)
end)

RegisterNetEvent('mdt:server:createInvoiceItem', function(payload)
  local playerId = source
  if not payload or type(payload) ~= 'table' then
    return
  end

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
