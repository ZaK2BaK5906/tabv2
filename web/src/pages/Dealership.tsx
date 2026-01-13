const vehicles = [
  { name: 'Comet S2', price: '$120,000', societyPrice: '$72,000' },
  { name: 'Buffalo STX', price: '$98,000', societyPrice: '$58,800' },
  { name: 'Tailgater S', price: '$75,000', societyPrice: '$45,000' }
];

const Dealership = () => (
  <div className="space-y-8">
    <header className="flex items-center justify-between">
      <div>
        <h2 className="font-display text-2xl">Module Concessionnaire</h2>
        <p className="text-white/50">Catalogue véhicules + achats société (-40%).</p>
      </div>
      <button className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 transition hover:bg-white/5">
        Historique achats
      </button>
    </header>

    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <input
          className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
          placeholder="Rechercher un véhicule..."
        />
        <button className="rounded-full bg-accent-600 px-4 py-2 text-sm font-medium text-base-950">
          Rechercher
        </button>
      </div>
    </div>

    <section className="grid grid-cols-3 gap-6">
      {vehicles.map((vehicle) => (
        <div key={vehicle.name} className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Véhicule</p>
              <p className="font-display text-xl">{vehicle.name}</p>
            </div>
            <div className="badge">Disponible</div>
          </div>
          <div className="mt-6 space-y-2 text-sm text-white/60">
            <div className="flex items-center justify-between">
              <span>Prix catalogue</span>
              <span className="text-white">{vehicle.price}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Prix société</span>
              <span className="text-accent-500">{vehicle.societyPrice}</span>
            </div>
          </div>
          <button className="mt-6 w-full rounded-full bg-accent-600 py-2 text-sm font-medium text-base-950">
            Acheter pour la société
          </button>
        </div>
      ))}
    </section>

    <section className="glass-panel rounded-2xl p-6">
      <h3 className="font-display text-lg">Comptes & marge concession</h3>
      <div className="mt-4 grid grid-cols-3 gap-4">
        {[
          { label: 'Solde société', value: '$1,245,600' },
          { label: 'Budget mensuel', value: '$420,000' },
          { label: 'Achats en cours', value: '$210,000' }
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">{metric.label}</p>
            <p className="mt-2 font-display text-xl">{metric.value}</p>
          </div>
        ))}
      </div>
    </section>
  </div>
);

export default Dealership;
