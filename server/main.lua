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
    grade = xPlayer.getJob().grade
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

registerModule('core', {
  hasPermission = hasPermission
})

exports('registerModule', registerModule)
exports('getModule', function(name)
  return Modules[name]
end)
