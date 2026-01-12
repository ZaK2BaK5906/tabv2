const employees = [
  {
    name: 'Mira Doucet',
    grade: 'Boss',
    invoices: 42,
    sales: '$82,400',
    commissionRate: '8%',
    commissionDue: '$6,592'
  },
  {
    name: 'Hugo Martel',
    grade: 'Senior',
    invoices: 28,
    sales: '$46,900',
    commissionRate: '5%',
    commissionDue: '$2,345'
  },
  {
    name: 'Lena Ortiz',
    grade: 'Junior',
    invoices: 17,
    sales: '$21,300',
    commissionRate: '4%',
    commissionDue: '$852'
  }
];

const Employees = () => (
  <div className="space-y-8">
    <header className="flex items-center justify-between">
      <div>
        <h2 className="font-display text-2xl">Gestion des employés</h2>
        <p className="text-white/50">
          Recrutement, promotions, commissions et resets par patron.
        </p>
      </div>
      <div className="flex gap-3">
        <button className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 transition hover:bg-white/5">
          Recruter
        </button>
        <button className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 shadow-soft">
          Paiements groupés
        </button>
      </div>
    </header>

    <section className="grid grid-cols-3 gap-6">
      {[
        { label: 'Effectif', value: '24' },
        { label: 'Commissions dues', value: '$9,789' },
        { label: 'Ventes 30j', value: '$150,320' }
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
          {['Tous', 'Boss', 'Senior', 'Junior'].map((filter) => (
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
          placeholder="Recherche employé..."
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
            <tr>
              <th className="px-6 py-4">Employé</th>
              <th className="px-6 py-4">Grade</th>
              <th className="px-6 py-4">Factures</th>
              <th className="px-6 py-4">Ventes</th>
              <th className="px-6 py-4">Commission</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.name} className="border-t border-white/5">
                <td className="px-6 py-4 font-medium">{employee.name}</td>
                <td className="px-6 py-4 text-white/70">{employee.grade}</td>
                <td className="px-6 py-4">{employee.invoices}</td>
                <td className="px-6 py-4">{employee.sales}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-accent-500">{employee.commissionDue}</span>
                    <span className="text-xs text-white/40">{employee.commissionRate}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-full bg-accent-600 px-3 py-1 text-xs font-medium text-base-950">
                      Payer
                    </button>
                    <button className="rounded-full border border-white/10 px-3 py-1 text-xs">
                      Promouvoir
                    </button>
                    <button className="rounded-full border border-white/10 px-3 py-1 text-xs">
                      Virer
                    </button>
                    <button className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                      Reset stats
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default Employees;
