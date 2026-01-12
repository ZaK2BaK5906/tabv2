import Icon from '../components/Icon';

const stats = [
  { label: 'Total facturé (30j)', value: '$328,540', change: '+12%', icon: 'chart' },
  { label: 'Taxes dues', value: '$42,310', change: '15% DOJ', icon: 'scale' },
  { label: 'Commissions', value: '$18,420', change: '5% actif', icon: 'money' },
  { label: 'Employés actifs', value: '24', change: '2 absents', icon: 'users' }
];

const Dashboard = () => (
  <div className="space-y-10">
    <section className="grid grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div key={stat.label} className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                {stat.label}
              </p>
              <p className="font-display text-2xl">{stat.value}</p>
              <span className="badge">{stat.change}</span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-xl">
              <Icon name={stat.icon} />
            </div>
          </div>
        </div>
      ))}
    </section>

    <section className="grid grid-cols-3 gap-6">
      <div className="glass-panel col-span-2 rounded-2xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl">Flux financier</h2>
            <p className="text-sm text-white/50">Vue mensuelle des factures et taxes.</p>
          </div>
          <div className="flex gap-2 text-sm">
            {['7j', '30j', '90j'].map((range) => (
              <button
                key={range}
                className="rounded-full border border-white/10 px-4 py-1 text-white/70 transition hover:bg-white/5"
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-8 flex h-52 items-end gap-3">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="flex-1 rounded-full bg-gradient-to-t from-brand-500/30 to-accent-500/70"
              style={{ height: `${40 + index * 5}%` }}
            />
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-8">
        <h2 className="font-display text-xl">Alertes DOJ</h2>
        <p className="text-sm text-white/50">Surveillance économique & conformité.</p>
        <div className="mt-6 space-y-4">
          {[
            {
              title: 'Factures sans taxe élevées',
              description: '3 factures dépassent le plafond autorisé.'
            },
            { title: 'Audit programmé', description: 'DOJ demande justificatifs.' }
          ].map((alert) => (
            <div key={alert.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-medium">{alert.title}</p>
              <p className="text-sm text-white/60">{alert.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  </div>
);

export default Dashboard;
