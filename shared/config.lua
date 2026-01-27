Config = {}

Config.ResourceName = 'mdt_premium'
Config.Commands = {
  tablet = 'mdt',
  facture = 'facture'
}
Config.Keybind = 'F4'
Config.DefaultJob = 'unemployed'
Config.InvoiceItem = 'mdt_invoice'

Config.Webhooks = {
  enabled = false,
  staff = ''
}

Config.Jobs = {
  doj = { label = 'Département de la Justice', minGrade = 0 },
  concessionnaire = { label = 'Concessionnaire', minGrade = 0 },
  auto_occaz = { label = 'Auto Occaz', minGrade = 0 },
  pawnshop = { label = 'Pawnshop', minGrade = 0 }
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

Config.InvoiceModes = {
  { id = 'citoyen', label = 'Facture client' },
  { id = 'entreprise', label = 'Facture entreprise' },
  {
    id = 'paiement_citoyen',
    label = 'Paiement citoyen',
    jobs = { 'auto_occaz', 'pawnshop' }
  }
}

return Config
