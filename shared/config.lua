Config = {}

Config.ResourceName = 'mdt_premium'
Config.Commands = {
  tablet = 'mdt',
  facture = 'facture'
}
Config.Keybind = 'F4'
Config.DefaultJob = 'unemployed'

Config.Jobs = {
  doj = { label = 'Département de la Justice', minGrade = 0 },
  concessionnaire = { label = 'Concessionnaire', minGrade = 0 }
}

Config.BossGradeName = 'boss'

Config.Taxes = {
  defaultRate = 0.15,
  allowTaxFree = true,
  allowDojTaxFree = true,
  maxTaxFreeInvoice = 10000,
  alertThresholdTaxFree = 5
}

Config.Commissions = {
  defaultRate = 0.05
}

Config.Products = {
  { label = 'Réparation moteur', price = 1200 },
  { label = 'Peinture complète', price = 3500 },
  { label = 'Alignement châssis', price = 800 }
}

return Config
