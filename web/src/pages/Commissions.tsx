import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';

type CommissionRow = {
  id: number;
  employee_name: string;
  amount: number;
  status: string;
  created_at: string;
};

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'short' });

const Commissions = () => {
  const [payouts, setPayouts] = useState<CommissionRow[]>([]);

  const loadPayouts = () => {
    fetchNui<{ ok: boolean; payouts: CommissionRow[] }>('mdt:getCommissions')
      .then((response) => {
        if (response.ok) {
          setPayouts(response.payouts ?? []);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    loadPayouts();
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'commissions') {
        loadPayouts();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
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
        {
          label: 'Commissions dues',
          value: currency.format(
            payouts.reduce((sum, row) => sum + (row.status === 'pending' ? row.amount : 0), 0)
          )
        },
        {
          label: 'Paiements en attente',
          value: payouts.filter((row) => row.status === 'pending').length
        },
        {
          label: 'Commissions payées',
          value: currency.format(
            payouts.reduce((sum, row) => sum + (row.status === 'paid' ? row.amount : 0), 0)
          )
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
                <td className="px-6 py-4 font-medium">COM-{payout.id}</td>
                <td className="px-6 py-4 text-white/70">{payout.employee_name}</td>
                <td className="px-6 py-4">{currency.format(payout.amount)}</td>
                <td className="px-6 py-4">{formatDate(payout.created_at)}</td>
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
};

export default Commissions;
