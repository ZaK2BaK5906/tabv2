local resourceName = GetCurrentResourceName()
local ESX = exports['es_extended'] and exports['es_extended']:getSharedObject() or nil
local isTabletOpen = false

-- Debug logging
local function log(msg)
  print('^3[MDT]^0 ' .. tostring(msg))
end

log('Resource starting: ' .. resourceName)

CreateThread(function()
  log('Waiting for ESX...')
  while not ESX do
    TriggerEvent('esx:getSharedObject', function(obj)
      ESX = obj
    end)
    if not ESX and exports['es_extended'] then
      ESX = exports['es_extended']:getSharedObject()
    end
    Wait(500)
  end
  log('ESX loaded successfully!')
end)

local function setNuiFocus(state)
  log('setNuiFocus: ' .. tostring(state))
  SetNuiFocus(state, state)
  if not state then
    SetNuiFocusKeepInput(false)
  end
end

local function closeTablet()
  log('closeTablet called, isTabletOpen=' .. tostring(isTabletOpen))
  if not isTabletOpen then return end
  isTabletOpen = false
  setNuiFocus(false)
  SendNUIMessage({ type = 'mdt:close' })
  log('Tablet closed')
end

local function openTablet(route)
  log('openTablet called, route=' .. tostring(route) .. ', isTabletOpen=' .. tostring(isTabletOpen))
  if isTabletOpen then return end
  isTabletOpen = true
  setNuiFocus(true)
  SendNUIMessage({ type = 'mdt:open', route = route or '/' })
  log('Tablet opened with route: ' .. tostring(route))
end

-- Ensure NUI is closed on resource start/stop
AddEventHandler('onResourceStart', function(resource)
  if resource ~= resourceName then return end
  -- CRITICAL: Force close on start to prevent background showing
  Wait(100)
  isTabletOpen = false
  setNuiFocus(false)
  SendNUIMessage({ type = 'mdt:close' })
end)

AddEventHandler('onResourceStop', function(resource)
  if resource ~= resourceName then return end
  closeTablet()
end)

-- Also close on player spawn to be safe
AddEventHandler('esx:playerLoaded', function()
  Wait(500)
  closeTablet()
end)

AddEventHandler('playerSpawned', function()
  Wait(500)
  closeTablet()
end)

RegisterCommand(Config.Commands.tablet, function()
  log('Command /' .. Config.Commands.tablet .. ' executed')
  if isTabletOpen then
    closeTablet()
  else
    openTablet('/')
  end
end, false)
log('Registered command: /' .. Config.Commands.tablet)

-- /facture opens the citizen invoice payment menu (my-invoices)
RegisterCommand(Config.Commands.facture, function()
  log('Command /' .. Config.Commands.facture .. ' executed')
  if isTabletOpen then
    closeTablet()
  else
    openTablet('/my-invoices')
  end
end, false)
log('Registered command: /' .. Config.Commands.facture)

RegisterKeyMapping(Config.Commands.tablet, 'Ouvrir/Fermer la tablette MDT', 'keyboard', Config.Keybind)

-- Variable to store target player for vehicle attribution
local targetPlayerForAttribution = nil

RegisterNUICallback('mdt:close', function(_, cb)
  log('NUI callback: mdt:close')
  closeTablet()
  cb({ ok = true })
end)

RegisterNUICallback('mdt:ready', function(_, cb)
  log('NUI callback: mdt:ready - NUI is loaded!')
  cb({ ok = true, resource = resourceName })
end)

RegisterNUICallback('mdt:getPlayerData', function(_, cb)
  log('NUI callback: mdt:getPlayerData')
  ESX.TriggerServerCallback('mdt:server:getPlayerData', function(response)
    log('mdt:getPlayerData response: ' .. json.encode(response))
    cb(response)
  end)
end)

RegisterNUICallback('mdt:getDashboardStats', function(_, cb)
  ESX.TriggerServerCallback('mdt:server:getDashboardStats', function(response)
    cb(response)
  end)
end)

RegisterNUICallback('mdt:createInvoice', function(data, cb)
  ESX.TriggerServerCallback('mdt:server:createInvoice', function(response)
    cb(response)
  end, data or {})
end)

RegisterNUICallback('mdt:getInvoices', function(data, cb)
  ESX.TriggerServerCallback('mdt:server:getInvoices', function(response)
    cb(response)
  end, data or {})
end)

RegisterNUICallback('mdt:getTaxSettings', function(_, cb)
  ESX.TriggerServerCallback('mdt:server:getTaxSettings', function(response)
    cb(response)
  end)
end)

RegisterNUICallback('mdt:getOverview', function(_, cb)
  ESX.TriggerServerCallback('mdt:server:getOverview', function(response)
    cb(response)
  end)
end)

RegisterNUICallback('mdt:updateTaxRate', function(data, cb)
  if data and data.rate then
    TriggerServerEvent('mdt:server:updateTaxRate', data.rate)
  end
  cb({ ok = true })
end)

RegisterNUICallback('mdt:getPartnerships', function(_, cb)
  ESX.TriggerServerCallback('mdt:server:getPartnerships', function(response)
    cb(response)
  end)
end)

RegisterNUICallback('mdt:savePartnership', function(data, cb)
  ESX.TriggerServerCallback('mdt:server:savePartnership', function(response)
    cb(response)
  end, data or {})
end)

RegisterNUICallback('mdt:getCommissions', function(_, cb)
  ESX.TriggerServerCallback('mdt:server:getCommissions', function(response)
    cb(response)
  end)
end)

RegisterNUICallback('mdt:createCommissionPayout', function(data, cb)
  ESX.TriggerServerCallback('mdt:server:createCommissionPayout', function(response)
    cb(response)
  end, data or {})
end)

RegisterNUICallback('mdt:getEmployeeStats', function(_, cb)
  ESX.TriggerServerCallback('mdt:server:getEmployeeStats', function(response)
    cb(response)
  end)
end)

RegisterNUICallback('mdt:updateCommissionRate', function(data, cb)
  ESX.TriggerServerCallback('mdt:server:updateCommissionRate', function(response)
    cb(response)
  end, data or {})
end)

RegisterNUICallback('mdt:resetEmployeeStats', function(data, cb)
  ESX.TriggerServerCallback('mdt:server:resetEmployeeStats', function(response)
    cb(response)
  end, data and data.identifier or nil)
end)

RegisterNetEvent('mdt:client:dataUpdated', function(payload)
  SendNUIMessage({
    type = 'mdt:dataUpdated',
    entity = payload and payload.entity or 'unknown'
  })
end)

-- ============================================
-- CITIZEN INVOICE SYSTEM
-- ============================================

RegisterNUICallback('mdt:getMyInvoices', function(_, cb)
  ESX.TriggerServerCallback('mdt:server:getMyInvoices', function(response)
    cb(response)
  end)
end)

RegisterNUICallback('mdt:payInvoice', function(data, cb)
  ESX.TriggerServerCallback('mdt:server:payInvoice', function(response)
    cb(response)
  end, data or {})
end)

-- ============================================
-- DEALERSHIP SYSTEM
-- ============================================

RegisterNUICallback('mdt:getVehicleCatalog', function(_, cb)
  ESX.TriggerServerCallback('mdt:server:getVehicleCatalog', function(response)
    cb(response)
  end)
end)

RegisterNUICallback('mdt:getDealershipStock', function(_, cb)
  ESX.TriggerServerCallback('mdt:server:getDealershipStock', function(response)
    cb(response)
  end)
end)

RegisterNUICallback('mdt:getSocietyMoney', function(_, cb)
  ESX.TriggerServerCallback('mdt:server:getSocietyMoney', function(response)
    cb(response)
  end)
end)

RegisterNUICallback('mdt:orderVehicle', function(data, cb)
  ESX.TriggerServerCallback('mdt:server:orderVehicle', function(response)
    cb(response)
  end, data or {})
end)

RegisterNUICallback('mdt:assignVehicle', function(data, cb)
  -- If we have a target player from ox_target, use that
  if targetPlayerForAttribution then
    data.targetPlayer = targetPlayerForAttribution
  end
  ESX.TriggerServerCallback('mdt:server:assignVehicle', function(response)
    if response.ok then
      targetPlayerForAttribution = nil
    end
    cb(response)
  end, data or {})
end)

-- ============================================
-- OX_TARGET INTEGRATION FOR VEHICLE ATTRIBUTION
-- ============================================

-- Check if ox_target is available
CreateThread(function()
  Wait(1000)
  if not exports.ox_target then
    print('[MDT] ox_target not found, vehicle attribution via target disabled')
    return
  end

  -- Add ox_target option for players (only for dealership)
  exports.ox_target:addGlobalPlayer({
    {
      name = 'mdt_assign_vehicle',
      icon = 'fas fa-car',
      label = 'Attribuer un véhicule',
      distance = 3.0,
      canInteract = function()
        local playerData = ESX.GetPlayerData()
        return playerData.job and (playerData.job.name == 'dealership' or playerData.job.name == 'cardealer')
      end,
      onSelect = function(data)
        if data.entity then
          local targetServerId = GetPlayerServerId(NetworkGetPlayerIndexFromPed(data.entity))
          if targetServerId and targetServerId > 0 then
            targetPlayerForAttribution = targetServerId
            openTablet('/dealership')
            -- Send message to UI to switch to assign tab
            Wait(500)
            SendNUIMessage({
              type = 'mdt:openAssignTab',
              targetPlayer = targetServerId
            })
          end
        end
      end
    }
  })

  print('[MDT] ox_target integration loaded')
end)

-- Event to open tablet on assign tab from ox_target
RegisterNetEvent('mdt:client:openAssignVehicle', function(targetId)
  targetPlayerForAttribution = targetId
  openTablet('/dealership')
end)
