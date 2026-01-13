const payouts = [
  { id: 'COM-1182', employee: 'Mira Doucet', amount: '$1,850', date: '12/03/2026', status: 'Payée' },
  { id: 'COM-1183', employee: 'Hugo Martel', amount: '$940', date: '12/03/2026', status: 'En attente' },
  { id: 'COM-1184', employee: 'Lena Ortiz', amount: '$420', date: '11/03/2026', status: 'Payée' }
];

const Commissions = () => (
  <div className="space-y-8">
    <header className="flex items-center justify-between">
      <div>
        <h2 className="font-display text-2xl">Commissions & paiements</h2>
        <p className="text-white/50">Validation patron, virement society, resets instant.</p>
      </div>
      <button className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 shadow-soft">
        Lancer le paiement
      </button>
    </header>

    <section className="grid grid-cols-3 gap-6">
      {[
        { label: 'Commissions dues', value: '$9,789' },
        { label: 'Paiements en attente', value: '$3,420' },
        { label: 'Commissions payées', value: '$18,200' }
      ].map((metric) => (
        <div key={metric.label} className="glass-panel rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">{metric.label}</p>
          <p className="mt-3 font-display text-3xl">{metric.value}</p>
        </div>
      ))}
    </section>

    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['Toutes', 'Payées', 'En attente'].map((filter) => (
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
          placeholder="Recherche commission..."
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Employé</th>
              <th className="px-6 py-4">Montant</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((payout) => (
              <tr key={payout.id} className="border-t border-white/5">
                <td className="px-6 py-4 font-medium">{payout.id}</td>
                <td className="px-6 py-4 text-white/70">{payout.employee}</td>
                <td className="px-6 py-4">{payout.amount}</td>
                <td className="px-6 py-4">{payout.date}</td>
                <td className="px-6 py-4">
                  <span className="badge">{payout.status}</span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-accent-500 transition hover:text-accent-600">
                    Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default Commissions;
