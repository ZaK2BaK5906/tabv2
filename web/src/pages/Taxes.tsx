const Taxes = () => (
  <div className="space-y-8">
    <header>
      <h2 className="font-display text-2xl">Contrôle fiscal DOJ</h2>
      <p className="text-white/50">Gestion globale des taxes, audits et sanctions RP.</p>
    </header>

    <section className="grid grid-cols-3 gap-6">
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Taux global</p>
        <div className="mt-3 flex items-end justify-between">
          <p className="font-display text-3xl">15%</p>
          <button className="rounded-full border border-white/10 px-4 py-1 text-sm">Modifier</button>
        </div>
        <div className="mt-4 text-sm text-white/60">
          Appliqué automatiquement sur toutes les factures taxées.
        </div>
      </div>
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Taxes générées</p>
        <p className="mt-3 font-display text-3xl">$128,430</p>
        <div className="mt-2 text-sm text-white/60">Période en cours</div>
      </div>
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Alertes actives</p>
        <p className="mt-3 font-display text-3xl">6</p>
        <div className="mt-2 text-sm text-white/60">Entreprises surveillées</div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-6">
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="font-display text-lg">Règles économiques</h3>
        <div className="mt-5 space-y-4 text-sm">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-medium">Plafond facturation sans taxe</p>
              <p className="text-white/50">$10,000</p>
            </div>
            <button className="rounded-full border border-white/10 px-4 py-1">Ajuster</button>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-medium">Seuil d'alerte</p>
              <p className="text-white/50">5 factures / 7 jours</p>
            </div>
            <button className="rounded-full border border-white/10 px-4 py-1">Ajuster</button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <h3 className="font-display text-lg">Actions RP disponibles</h3>
        <div className="mt-5 space-y-3">
          {['Amende', 'Gel entreprise', 'Audit forcé', 'Forcer paiement'].map((action) => (
            <div
              key={action}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <p>{action}</p>
              <button className="rounded-full bg-accent-600 px-4 py-1 text-sm text-base-950">
                Appliquer
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="glass-panel rounded-2xl p-6">
      <h3 className="font-display text-lg">Entreprises sous audit</h3>
      <div className="mt-4 grid grid-cols-3 gap-4">
        {['Benny\'s Customs', 'Maze Bank', 'Dynasty 8'].map((company) => (
          <div key={company} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="font-medium">{company}</p>
            <p className="text-sm text-white/50">Taxes dues élevées</p>
            <button className="mt-3 text-sm text-accent-500">Voir rapport</button>
          </div>
        ))}
      </div>
    </section>
  </div>
);

export default Taxes;
