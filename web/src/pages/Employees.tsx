import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';

type EmployeeRow = {
  identifier: string;
  firstname?: string;
  lastname?: string;
  job_grade: number;
  invoices_count?: number;
  sales_total?: number;
  commission_rate?: number;
  commission_due?: number;
};

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const formatPercent = (value?: number) =>
  value !== undefined ? `${Math.round(value * 100)}%` : '—';

const Employees = () => {
  const [rows, setRows] = useState<EmployeeRow[]>([]);

  const loadEmployees = () => {
    fetchNui<{ ok: boolean; employees: EmployeeRow[] }>('mdt:getEmployeeStats')
      .then((response) => {
        if (response.ok) {
          setRows(response.employees ?? []);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    loadEmployees();
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'employees') {
        loadEmployees();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleReset = (identifier: string) => {
    fetchNui('mdt:resetEmployeeStats', { identifier }).catch(() => undefined);
  };

  return (
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
        { label: 'Effectif', value: rows.length },
        {
          label: 'Commissions dues',
          value: currency.format(rows.reduce((sum, row) => sum + (row.commission_due ?? 0), 0))
        },
        {
          label: 'Ventes 30j',
          value: currency.format(rows.reduce((sum, row) => sum + (row.sales_total ?? 0), 0))
        }
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
        <div className="flex items-center gap-2">
          <input
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Recherche employé..."
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
              <th className="px-6 py-4">Employé</th>
              <th className="px-6 py-4">Grade</th>
              <th className="px-6 py-4">Factures</th>
              <th className="px-6 py-4">Ventes</th>
              <th className="px-6 py-4">Commission</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((employee) => (
              <tr key={employee.identifier} className="border-t border-white/5">
                <td className="px-6 py-4 font-medium">
                  {[employee.firstname, employee.lastname].filter(Boolean).join(' ') ||
                    employee.identifier}
                </td>
                <td className="px-6 py-4 text-white/70">{employee.job_grade ?? 0}</td>
                <td className="px-6 py-4">{employee.invoices_count ?? 0}</td>
                <td className="px-6 py-4">
                  {currency.format(employee.sales_total ?? 0)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-accent-500">
                      {currency.format(employee.commission_due ?? 0)}
                    </span>
                    <span className="text-xs text-white/40">
                      {formatPercent(employee.commission_rate)}
                    </span>
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
                    <button
                      onClick={() => handleReset(employee.identifier)}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60"
                    >
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
};

export default Employees;
