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

## Commandes / Keybinds
- `/mdt` : ouvre la tablette
- `/facture` : ouvre directement l'écran Factures
- Touche par défaut : `F4` (modifiable dans `shared/config.lua`)

## Configuration (FR)
- `shared/config.lua` contient les réglages jobs, taxes, commissions et la liste des produits.
- **Aucune table SQL personnalisée** : le script utilise les tables ESX existantes (`users`, `billing`, etc.).
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
