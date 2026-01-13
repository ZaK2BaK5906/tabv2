const partnerships = [
  {
    company: 'Benny\'s Customs',
    discount: '12%',
    status: 'Actif',
    notes: 'Réduction pièces & main d\'œuvre'
  },
  {
    company: 'Bean Machine',
    discount: '6%',
    status: 'En attente',
    notes: 'Accord sur catering'
  }
];

const Partnerships = () => (
  <div className="space-y-8">
    <header className="flex items-center justify-between">
      <div>
        <h2 className="font-display text-2xl">Partenariats entreprises</h2>
        <p className="text-white/50">
          Gérez les accords, réductions et clauses de facturation.
        </p>
      </div>
      <button className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 shadow-soft">
        Nouveau partenariat
      </button>
    </header>

    <section className="grid grid-cols-3 gap-6">
      {[
        { label: 'Partenariats actifs', value: '8' },
        { label: 'Réduction moyenne', value: '9%' },
        { label: 'Économies estimées', value: '$24,500' }
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
          {['Tous', 'Actifs', 'En attente'].map((filter) => (
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
          placeholder="Recherche entreprise..."
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
            <tr>
              <th className="px-6 py-4">Entreprise</th>
              <th className="px-6 py-4">Réduction</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4">Notes</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {partnerships.map((partnership) => (
              <tr key={partnership.company} className="border-t border-white/5">
                <td className="px-6 py-4 font-medium">{partnership.company}</td>
                <td className="px-6 py-4 text-accent-500">{partnership.discount}</td>
                <td className="px-6 py-4">
                  <span className="badge">{partnership.status}</span>
                </td>
                <td className="px-6 py-4 text-white/60">{partnership.notes}</td>
                <td className="px-6 py-4">
                  <button className="text-accent-500 transition hover:text-accent-600">
                    Modifier
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

export default Partnerships;
