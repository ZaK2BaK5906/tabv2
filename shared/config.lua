Config = {}

Config.ResourceName = 'mdt_premium'
Config.Command = 'mdt'
Config.Keybind = 'F4'

Config.Jobs = {
  doj = { label = 'Department of Justice', minGrade = 0 },
  concessionnaire = { label = 'Concessionnaire', minGrade = 0 }
}

Config.Taxes = {
  defaultRate = 0.15,
  allowTaxFree = true,
  maxTaxFreeInvoice = 10000,
  alertThresholdTaxFree = 5
}

Config.Commissions = {
  defaultRate = 0.05
}

return Config
