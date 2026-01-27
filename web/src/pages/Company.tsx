import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';

type CompanyData = {
  societyMoney: number;
  totalCommissionsDue: number;
  totalTaxesDue: number;
  employeesCount: number;
  pendingInvoices: number;
};

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const Company = () => {
  const { player } = usePlayerStore();
  const [data, setData] = useState<CompanyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const isBoss = player?.isBoss ?? false;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await fetchNui<{ ok: boolean; data: CompanyData }>('mdt:getCompanyData');
      if (response.ok) {
        setData(response.data);
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated') {
        loadData();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const estimatedBalance = (data?.societyMoney ?? 0) - (data?.totalCommissionsDue ?? 0) - (data?.totalTaxesDue ?? 0);

  const handleResetStats = async () => {
    setIsResetting(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:resetCompanyStats');
      if (response.ok) {
        setShowResetModal(false);
        loadData();
      }
    } catch {
      // ignore
    }
    setIsResetting(false);
  };

  if (!isBoss) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Acces reserve aux patrons
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Chargement des donnees...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Gestion Societe</h2>
          <p className="text-white/50">Vue globale de la tresorerie et des obligations.</p>
        </div>
        <button
          onClick={() => setShowResetModal(true)}
          className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 transition hover:bg-white/5"
        >
          Reset statistiques
        </button>
      </header>

      <section className="grid grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Solde Societe</p>
          <p className="mt-3 font-display text-4xl text-accent-500">
            {currency.format(data?.societyMoney ?? 0)}
          </p>
          <p className="mt-2 text-sm text-white/40">Caisse de l'entreprise</p>
        </div>

        <div className="glass-panel rounded-2xl p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Solde estime apres paiements</p>
          <p className={`mt-3 font-display text-4xl ${estimatedBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {currency.format(estimatedBalance)}
          </p>
          <p className="mt-2 text-sm text-white/40">Apres commissions et taxes</p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Commissions a payer</p>
          <p className="mt-3 font-display text-3xl text-orange-400">
            {currency.format(data?.totalCommissionsDue ?? 0)}
          </p>
          <p className="mt-2 text-sm text-white/40">Total des employes</p>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Taxes dues au DOJ</p>
          <p className="mt-3 font-display text-3xl text-red-400">
            {currency.format(data?.totalTaxesDue ?? 0)}
          </p>
          <p className="mt-2 text-sm text-white/40">TVA collectee</p>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Effectif</p>
          <p className="mt-3 font-display text-3xl">{data?.employeesCount ?? 0}</p>
          <p className="mt-2 text-sm text-white/40">Employes actifs</p>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-8">
        <h3 className="font-display text-xl">Resume financier</h3>
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-white/70">Solde actuel</span>
            <span className="font-display text-lg">{currency.format(data?.societyMoney ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-white/70">- Commissions dues</span>
            <span className="font-display text-lg text-orange-400">- {currency.format(data?.totalCommissionsDue ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
            <span className="text-white/70">- Taxes DOJ</span>
            <span className="font-display text-lg text-red-400">- {currency.format(data?.totalTaxesDue ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-accent-500/30 bg-accent-500/10 p-4">
            <span className="font-medium">= Solde estime</span>
            <span className={`font-display text-xl ${estimatedBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {currency.format(estimatedBalance)}
            </span>
          </div>
        </div>
      </section>

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display text-lg">Reset des statistiques</h3>
            <p className="mt-2 text-sm text-white/50">
              Cette action va remettre a zero toutes les statistiques de ventes et commissions des employes.
            </p>
            <p className="mt-4 text-sm text-white/70">
              Le solde de la societe ne sera pas affecte.
            </p>
            <p className="mt-2 text-sm text-orange-400">
              Attention: Les commissions non payees seront perdues!
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={handleResetStats}
                disabled={isResetting}
                className="rounded-full bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {isResetting ? 'Reset...' : 'Confirmer le reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Company;
