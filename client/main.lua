local resourceName = GetCurrentResourceName()

local function setNuiFocus(state)
  SetNuiFocus(state, state)
  SetNuiFocusKeepInput(state)
  if state then
    DisableControlAction(0, 1, true)
    DisableControlAction(0, 2, true)
  end
end

local function openTablet(route)
  setNuiFocus(true)
  SendNUIMessage({ type = 'mdt:open', route = route })
end

RegisterCommand(Config.Commands.tablet, function()
  openTablet('/')
end, false)

RegisterCommand(Config.Commands.facture, function()
  openTablet('/invoices')
end, false)

RegisterKeyMapping(Config.Commands.tablet, 'Ouvrir la tablette MDT', 'keyboard', Config.Keybind)

RegisterNUICallback('mdt:close', function(_, cb)
  setNuiFocus(false)
  cb({ ok = true })
end)

RegisterNUICallback('mdt:ready', function(_, cb)
  cb({ ok = true, resource = resourceName })
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

RegisterNUICallback('mdt:updateTaxRate', function(data, cb)
  if data and data.rate then
    TriggerServerEvent('mdt:server:updateTaxRate', data.rate)
  end
  cb({ ok = true })
end)

RegisterNetEvent('mdt:client:dataUpdated', function(payload)
  SendNUIMessage({
    type = 'mdt:dataUpdated',
    entity = payload and payload.entity or 'unknown'
  })
end)
