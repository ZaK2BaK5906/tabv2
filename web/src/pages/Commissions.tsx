import { useEffect, useState, useCallback } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';
import Icon from '../components/Icon';

type CommissionRow = {
  id: number;
  employee_identifier: string;
  employee_name: string;
  amount: number;
  status: string;
  created_at: string;
};

type CommissionStats = {
  totalPending: number;
  totalPaid: number;
  pendingCount: number;
  societyBalance: number;
};

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const Commissions = () => {
  const { player } = usePlayerStore();
  const [payouts, setPayouts] = useState<CommissionRow[]>([]);
  const [stats, setStats] = useState<CommissionStats>({
    totalPending: 0,
    totalPaid: 0,
    pendingCount: 0,
    societyBalance: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadPayouts = useCallback(() => {
    fetchNui<{ ok: boolean; payouts: CommissionRow[]; stats?: CommissionStats }>('mdt:getCommissions')
      .then((response) => {
        if (response.ok) {
          setPayouts(response.payouts ?? []);
          if (response.stats) {
            setStats(response.stats);
          } else {
            // Calculate stats from payouts
            const pending = response.payouts?.filter(p => p.status === 'pending') ?? [];
            const paid = response.payouts?.filter(p => p.status === 'paid') ?? [];
            setStats({
              totalPending: pending.reduce((sum, p) => sum + p.amount, 0),
              totalPaid: paid.reduce((sum, p) => sum + p.amount, 0),
              pendingCount: pending.length,
              societyBalance: 0
            });
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  const loadSocietyBalance = useCallback(() => {
    fetchNui<{ ok: boolean; balance: number }>('mdt:getSocietyMoney')
      .then((response) => {
        if (response.ok) {
          setStats(prev => ({ ...prev, societyBalance: response.balance ?? 0 }));
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadPayouts();
    loadSocietyBalance();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'commissions') {
        loadPayouts();
        loadSocietyBalance();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadPayouts, loadSocietyBalance]);

  const handlePayAll = async () => {
    const pendingPayouts = payouts.filter(p => p.status === 'pending');
    if (pendingPayouts.length === 0) return;

    const totalAmount = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

    setIsProcessing(true);
    try {
      const response = await fetchNui<{ ok: boolean; reason?: string }>('mdt:payAllCommissions', {
        totalAmount,
        payouts: pendingPayouts.map(p => ({
          id: p.id,
          employeeIdentifier: p.employee_identifier,
          employeeName: p.employee_name,
          amount: p.amount
        }))
      });

      if (response.ok) {
        loadPayouts();
        loadSocietyBalance();
      }
    } catch {
      // ignore
    }
    setIsProcessing(false);
  };

  const handlePaySingle = async (payout: CommissionRow) => {
    setIsProcessing(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:payCommission', {
        payoutId: payout.id,
        employeeIdentifier: payout.employee_identifier,
        employeeName: payout.employee_name,
        amount: payout.amount
      });

      if (response.ok) {
        loadPayouts();
        loadSocietyBalance();
      }
    } catch {
      // ignore
    }
    setIsProcessing(false);
  };

  const handleReset = async (payoutId: number) => {
    try {
      await fetchNui('mdt:resetCommission', { id: payoutId });
      loadPayouts();
    } catch {
      // ignore
    }
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

  const isBoss = player?.isBoss ?? false;
  const pendingTotal = payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Commissions et paiements</h2>
          <p className="text-white/50">
            Validation patron, virement sur compte societe, historique des paiements.
          </p>
        </div>
        {isBoss && pendingTotal > 0 && (
          <button
            onClick={handlePayAll}
            disabled={isProcessing}
            className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 shadow-soft disabled:opacity-50"
          >
            {isProcessing ? 'Paiement...' : `Payer tout (${currency.format(pendingTotal)})`}
          </button>
        )}
      </header>

      <section className="grid grid-cols-4 gap-6">
        {[
          {
            label: 'Commissions dues',
            value: currency.format(stats.totalPending),
            icon: 'money',
            color: 'text-orange-400 bg-orange-500/20'
          },
          {
            label: 'En attente',
            value: String(stats.pendingCount),
            icon: 'clock',
            color: 'text-yellow-400 bg-yellow-500/20'
          },
          {
            label: 'Commissions payees',
            value: currency.format(stats.totalPaid),
            icon: 'check',
            color: 'text-green-400 bg-green-500/20'
          },
          {
            label: 'Solde societe',
            value: currency.format(stats.societyBalance),
            icon: 'box',
            color: 'text-accent-400 bg-accent-500/20'
          }
        ].map((metric) => (
          <div key={metric.label} className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${metric.color}`}>
                <Icon name={metric.icon} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">{metric.label}</p>
                <p className="mt-1 font-display text-2xl">{metric.value}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[
              { id: 'all' as const, label: 'Toutes' },
              { id: 'pending' as const, label: 'En attente' },
              { id: 'paid' as const, label: 'Payees' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                  filter === f.id
                    ? 'bg-accent-600 text-base-950 font-medium'
                    : 'border border-white/10 text-white/60 hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
              placeholder="Recherche commission..."
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="rounded-full border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
              >
                Effacer
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6 text-center text-white/50 py-12">Chargement...</div>
        ) : filteredPayouts.length === 0 ? (
          <div className="mt-6 text-center text-white/50 py-12">
            <div className="flex justify-center mb-2">
              <Icon name="money" />
            </div>
            <p>Aucune commission trouvee</p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Employe</th>
                  <th className="px-6 py-4">Montant</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Statut</th>
                  {isBoss && <th className="px-6 py-4">Actions</th>}
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
                        {payout.status === 'paid' ? 'Payee' : 'En attente'}
                      </span>
                    </td>
                    {isBoss && (
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {payout.status === 'pending' && (
                            <button
                              onClick={() => handlePaySingle(payout)}
                              disabled={isProcessing}
                              className="rounded-full bg-accent-600 px-3 py-1 text-xs font-medium text-base-950 disabled:opacity-50"
                            >
                              Payer
                            </button>
                          )}
                          <button
                            onClick={() => handleReset(payout.id)}
                            className="text-white/50 transition hover:text-white/70"
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Commissions;
