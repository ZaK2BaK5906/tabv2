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

const Invoices = () => (
  <div className="space-y-8">
    <header className="flex items-center justify-between">
      <div>
        <h2 className="font-display text-2xl">Facturation clients</h2>
        <p className="text-white/50">Prévisualisation obligatoire HT / TVA / TTC.</p>
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
        <input
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
          placeholder="Recherche instantanée..."
        />
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
