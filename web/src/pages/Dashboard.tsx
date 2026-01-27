import { useEffect } from 'react';
import Icon from '../components/Icon';
import { useDashboardStore } from '../store/dashboardStore';
import { usePlayerStore } from '../store/playerStore';

const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('$US', '$');
};

const Dashboard = () => {
  const { stats, isLoading, fetchStats } = useDashboardStore();
  const { player } = usePlayerStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statsCards = [
    {
      label: 'Total facture (periode)',
      value: formatMoney(stats?.totalInvoiced ?? 0),
      change: player?.job?.label ?? '—',
      icon: 'chart'
    },
    {
      label: 'Taxes dues',
      value: formatMoney(stats?.taxesDue ?? 0),
      change: 'TVA collectee',
      icon: 'scale'
    },
    {
      label: 'Commissions',
      value: formatMoney(stats?.commissionsTotal ?? 0),
      change: 'Total a payer',
      icon: 'money'
    },
    {
      label: 'Employes',
      value: String(stats?.employeesCount ?? 0),
      change: player?.isBoss ? 'Patron' : 'Employe',
      icon: 'users'
    }
  ];

  const myStats = [
    { label: 'Mes factures', value: String(stats?.myInvoicesCount ?? 0) },
    { label: 'Mes ventes', value: formatMoney(stats?.mySalesTotal ?? 0) },
    { label: 'Ma commission', value: formatMoney(stats?.myCommissionDue ?? 0) }
  ];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Chargement des statistiques...
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-4 gap-6">
        {statsCards.map((stat) => (
          <div key={stat.label} className="glass-panel rounded-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2 min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50 truncate">
                  {stat.label}
                </p>
                <p className="font-display text-2xl truncate">{stat.value}</p>
                <span className="badge truncate">{stat.change}</span>
              </div>
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/5 text-xl">
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
              <h2 className="font-display text-xl">Bienvenue, {player?.firstname ?? 'Utilisateur'}</h2>
              <p className="text-sm text-white/50">
                {player?.job?.label ?? player?.job?.name ?? 'Aucun emploi'} - {player?.job?.gradeLabel ?? player?.job?.gradeName ?? '—'}
              </p>
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
                style={{ height: `${20 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-8">
          <h2 className="font-display text-xl">Mes statistiques</h2>
          <p className="text-sm text-white/50">Performance personnelle</p>
          <div className="mt-6 space-y-4">
            {myStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">{stat.label}</p>
                <p className="mt-2 font-display text-xl">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
