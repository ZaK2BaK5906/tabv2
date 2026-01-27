import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';

type CommissionRow = {
  id: number;
  employee_name: string;
  employee_identifier?: string;
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
  const { player } = usePlayerStore();
  const [payouts, setPayouts] = useState<CommissionRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);

  const isBoss = player?.isBoss ?? false;

  const loadPayouts = async () => {
    setIsLoading(true);
    try {
      const response = await fetchNui<{ ok: boolean; payouts: CommissionRow[] }>('mdt:getCommissions');
      if (response.ok) {
        setPayouts(response.payouts ?? []);
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
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

  const handlePayAll = async () => {
    setIsActioning(true);
    try {
      const response = await fetchNui<{ ok: boolean; paid?: number; total?: number; reason?: string }>('mdt:payAllCommissions');
      if (response.ok) {
        loadPayouts();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  // Filter payouts
  const filteredPayouts = payouts.filter((p) => {
    if (filter === 'paid' && p.status !== 'paid') return false;
    if (filter === 'pending' && p.status !== 'pending') return false;
    if (search) {
      return p.employee_name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const pendingTotal = payouts.reduce((sum, p) => sum + (p.status === 'pending' ? p.amount : 0), 0);
  const paidTotal = payouts.reduce((sum, p) => sum + (p.status === 'paid' ? p.amount : 0), 0);
  const pendingCount = payouts.filter((p) => p.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Chargement des commissions...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Commissions & paiements</h2>
          <p className="text-white/50">Validation patron, virement society, historique.</p>
        </div>
        {isBoss && pendingCount > 0 && (
          <button
            onClick={handlePayAll}
            disabled={isActioning}
            className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 shadow-soft disabled:opacity-50"
          >
            {isActioning ? 'Paiement...' : `Payer tout (${pendingCount})`}
          </button>
        )}
      </header>

      <section className="grid grid-cols-3 gap-6">
        {[
          { label: 'Commissions dues', value: currency.format(pendingTotal) },
          { label: 'Paiements en attente', value: pendingCount },
          { label: 'Commissions payees', value: currency.format(paidTotal) }
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
            {(['all', 'paid', 'pending'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                  filter === f
                    ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                    : 'border-white/10 text-white/60 hover:bg-white/5'
                }`}
              >
                {f === 'all' ? 'Toutes' : f === 'paid' ? 'Payees' : 'En attente'}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Recherche commission..."
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Employe</th>
                <th className="px-6 py-4">Montant</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayouts.map((payout) => (
                <tr key={payout.id} className="border-t border-white/5">
                  <td className="px-6 py-4 font-medium">COM-{payout.id}</td>
                  <td className="px-6 py-4 text-white/70">{payout.employee_name}</td>
                  <td className="px-6 py-4 text-accent-500">{currency.format(payout.amount)}</td>
                  <td className="px-6 py-4 text-white/50">{formatDate(payout.created_at)}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs ${
                      payout.status === 'paid'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {payout.status === 'paid' ? 'Paye' : 'En attente'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredPayouts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-white/50">
                    Aucune commission trouvee
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Commissions;
