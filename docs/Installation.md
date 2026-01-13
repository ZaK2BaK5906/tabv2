# Installation FiveM - MDT Premium (ESX)

## Prérequis
- ESX dernière génération
- oxmysql
- Node.js (pour compiler la NUI)

## Étapes d'installation
1. **Copiez le dossier du script** dans votre `resources/`.
2. **Installez les dépendances NUI** :
   ```bash
   cd web
   npm install
   npm run build
   ```
3. **Vérifiez `fxmanifest.lua`** : le fichier charge `web/dist` après le build.
4. **Ajoutez la ressource** à votre `server.cfg` :
   ```cfg
   ensure mdt_premium
   ```
5. **Redémarrez votre serveur**.

## Installation SQL (recommandée)
- Le script crée automatiquement les tables si `oxmysql` est actif et que l'utilisateur SQL a les droits `CREATE`.
- Si vous préférez installer manuellement : importez `sql/install.sql` dans votre base.
- Tables incluses : taxes (`mdt_tax_settings`, `mdt_tax_rules`), factures (`mdt_invoices`), produits (`mdt_products`), partenariats (`mdt_partnerships`), commissions (`mdt_commission_payouts`) et stats employés (`mdt_employee_stats`).

## Commandes / Keybinds
- `/mdt` : ouvre la tablette
- `/facture` : ouvre directement l'écran Factures
- Touche par défaut : `F4` (modifiable dans `shared/config.lua`)

## Configuration (FR)
- `shared/config.lua` contient les réglages jobs, taxes, commissions et la liste des produits.
- Les tables SQL supplémentaires sont dans `sql/install.sql` (factures, produits, taxes).
- Les jobs `auto_occaz` et `pawnshop` sont prévus pour un mode **paiement joueur** (rachat/occasions).

## Produits / Prix HT
- Les produits par défaut sont listés dans `Config.Products`.
- Le patron pourra ajouter des produits directement depuis l'UI (scaffold prêt pour branchement serveur).

## ox_inventory (items facture)
Ajoutez un item dans `ox_inventory/data/items.lua` :
```lua
['mdt_invoice'] = {
  label = 'Ticket de caisse',
  weight = 10,
  stack = false,
  close = true,
  description = 'Facture MDT avec metadata'
}
```
Le script envoie les metadata suivantes : `invoice_id`, `mode`, `product`, `amount`, `tax_rate`, `tax_amount`, `total`, `issuer`, `job`, `created_at`.

## Notes
- Les écrans sont prévus pour une évolution modulaire (DOJ, Concession, EMS/Police).
- Pour un premier test : build NUI, démarrez la ressource, ouvrez `/mdt` ou `/facture`.
