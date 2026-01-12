local resourceName = GetCurrentResourceName()

local function setNuiFocus(state)
  SetNuiFocus(state, state)
  SetNuiFocusKeepInput(state)
  if state then
    DisableControlAction(0, 1, true)
    DisableControlAction(0, 2, true)
  end
end

RegisterCommand(Config.Command, function()
  setNuiFocus(true)
  SendNUIMessage({ type = 'mdt:open' })
end, false)

RegisterKeyMapping(Config.Command, 'Open MDT Tablet', 'keyboard', Config.Keybind)

RegisterNUICallback('mdt:close', function(_, cb)
  setNuiFocus(false)
  cb({ ok = true })
end)

RegisterNUICallback('mdt:ready', function(_, cb)
  cb({ ok = true, resource = resourceName })
end)
