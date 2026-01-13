const invoices = [
  {
    id: 'INV-2042',
    client: 'LS Customs',
    amount: '$4,800',
    tax: '15%',
    status: 'Payée'
  },
  {
    id: 'INV-2043',
    client: 'Drift Works',
    amount: '$9,200',
    tax: 'Sans taxe',
    status: 'En attente'
  },
  {
    id: 'INV-2044',
    client: 'Pillbox Medical',
    amount: '$12,150',
    tax: '15%',
    status: 'Impayée'
  }
];

import { fetchNui } from '../features/nui';

const handleSendInvoice = () => {
  fetchNui('mdt:createInvoice', {
    invoiceId: `INV-${Date.now()}`,
    mode: 'citoyen',
    product: 'Réparation moteur',
    amount: 1200,
    taxRate: 0.15,
    taxAmount: 180,
    total: 1380,
    issuer: 'MDT'
  }).catch(() => undefined);
};

const Invoices = () => (
  <div className="space-y-8">
    <header className="flex items-center justify-between">
      <div>
        <h2 className="font-display text-2xl">Facturation clients</h2>
        <p className="text-white/50">
          Prévisualisation obligatoire HT / TVA / TTC. Le DOJ peut facturer sans TVA.
        </p>
      </div>
      <div className="flex gap-3">
        <button className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 transition hover:bg-white/5">
          Exporter
        </button>
        <button className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 shadow-soft">
          Nouvelle facture
        </button>
      </div>
    </header>

    <section className="grid grid-cols-3 gap-6">
      <div className="glass-panel col-span-2 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg">Créer une facture</h3>
            <p className="text-sm text-white/50">
              Client citoyen ou entreprise (paiement patron).
            </p>
          </div>
          <div className="flex gap-2">
            {['Facture client', 'Facture entreprise', 'Paiement joueur'].map((type) => (
              <button
                key={type}
                className="rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-white/60 transition hover:bg-white/5"
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Sélection joueur</p>
            <div className="mt-3 flex items-center justify-between rounded-full border border-white/10 bg-base-900 px-4 py-2">
              <span className="text-white/70">Joueur le plus proche</span>
              <button className="rounded-full bg-accent-600 px-3 py-1 text-xs text-base-950">
                Scanner
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                placeholder="Ou ID joueur"
              />
              <button className="rounded-full border border-white/10 px-4 py-2 text-xs">
                OK
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Détails</p>
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <button className="rounded-full border border-white/10 px-3 py-1 text-xs">
                  Produit
                </button>
                <button className="rounded-full border border-white/10 px-3 py-1 text-xs">
                  Prix custom
                </button>
              </div>
              <select className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                <option>Choisir un produit</option>
                <option>Réparation moteur — $1,200</option>
                <option>Peinture complète — $3,500</option>
                <option>Alignement châssis — $800</option>
              </select>
              <input
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                placeholder="Motif / prestation"
              />
              <input
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                placeholder="Montant HT"
              />
              <div className="flex items-center gap-2 text-xs text-white/60">
                <button className="rounded-full border border-white/10 px-3 py-1">Taxe auto</button>
                <button className="rounded-full border border-white/10 px-3 py-1">Sans taxe</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <h3 className="font-display text-lg">Prévisualisation</h3>
        <p className="text-sm text-white/50">HT / TVA / TTC avant validation.</p>
        <div className="mt-6 space-y-3 text-sm">
          {[
            { label: 'Montant HT', value: '$1,200' },
            { label: 'TVA (15%)', value: '$180' },
            { label: 'Total TTC', value: '$1,380' }
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-white/60">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </div>
        <button
          onClick={handleSendInvoice}
          className="mt-6 w-full rounded-full bg-accent-600 py-2 text-sm font-medium text-base-950"
        >
          Envoyer la facture
        </button>
      </div>
    </section>

    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['Toutes', 'Payées', 'Impayées', 'Sans taxe'].map((filter) => (
            <button
              key={filter}
              className="rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-white/60 transition hover:bg-white/5"
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Recherche instantanée..."
          />
          <button className="rounded-full bg-accent-600 px-4 py-2 text-xs font-medium text-base-950">
            Rechercher
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Client</th>
              <th className="px-6 py-4">Montant</th>
              <th className="px-6 py-4">Taxe</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-white/5">
                <td className="px-6 py-4 font-medium">{invoice.id}</td>
                <td className="px-6 py-4 text-white/70">{invoice.client}</td>
                <td className="px-6 py-4">{invoice.amount}</td>
                <td className="px-6 py-4">
                  <span className="badge">{invoice.tax}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs">
                    {invoice.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-accent-500 transition hover:text-accent-600">
                    Prévisualiser
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm text-white/60">
        <span>Affichage 1-3 sur 24</span>
        <div className="flex gap-2">
          <button className="rounded-full border border-white/10 px-3 py-1">Précédent</button>
          <button className="rounded-full border border-white/10 px-3 py-1">Suivant</button>
        </div>
      </div>
    </div>
  </div>
);

export default Invoices;
