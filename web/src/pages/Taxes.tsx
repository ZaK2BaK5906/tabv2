import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';

type Society = {
  job_name: string;
  label: string;
  money: number;
  taxes_generated: number;
  taxes_pending: number;
  taxes_paid: number;
  invoice_count: number;
  is_frozen: boolean;
};

type DojStats = {
  totalTaxesGenerated: number;
  totalTaxesPending: number;
  totalTaxesPaid: number;
  societiesCount: number;
  frozenCount: number;
  activeFines: number;
  dojBalance: number;
};

type DojAction = {
  id: number;
  action_type: string;
  amount: number;
  reason: string;
  agent_identifier: string;
  status: string;
  created_at: string;
};

type ExportData = {
  job_name: string;
  exported_at: string;
  exported_by: string;
  balance: number;
  employees: unknown[];
  invoices: unknown[];
  doj_actions: unknown[];
  partnerships: unknown[];
};

const formatMoney = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
};

const currency = {
  format: (value: number) => formatMoney(value)
};

const Taxes = () => {
  const [stats, setStats] = useState<DojStats | null>(null);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);

  // Modal states
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'fine' | 'freeze' | 'payment' | 'export' | null>(null);
  const [selectedSociety, setSelectedSociety] = useState<Society | null>(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionReason, setActionReason] = useState('');

  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState<DojAction[]>([]);

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState<ExportData | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, societiesRes] = await Promise.all([
        fetchNui<{ ok: boolean; stats: DojStats }>('mdt:getDojStats'),
        fetchNui<{ ok: boolean; societies: Society[] }>('mdt:getAllSocieties')
      ]);

      if (statsRes.ok) setStats(statsRes.stats);
      if (societiesRes.ok) setSocieties(societiesRes.societies ?? []);
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'doj') {
        loadData();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const openActionModal = (society: Society, type: 'fine' | 'freeze' | 'payment' | 'export') => {
    setSelectedSociety(society);
    setActionType(type);
    setActionAmount('');
    setActionReason('');
    setShowActionModal(true);
  };

  const handleAction = async () => {
    if (!selectedSociety || !actionType) return;
    setIsActioning(true);

    try {
      let response: { ok: boolean; data?: ExportData; amount?: number };

      switch (actionType) {
        case 'fine':
          if (!actionAmount || !actionReason) {
            setIsActioning(false);
            return;
          }
          response = await fetchNui('mdt:fineCompany', {
            job_name: selectedSociety.job_name,
            amount: parseInt(actionAmount, 10),
            reason: actionReason
          });
          break;

        case 'freeze':
          if (!actionReason) {
            setIsActioning(false);
            return;
          }
          response = await fetchNui('mdt:freezeCompany', {
            job_name: selectedSociety.job_name,
            reason: actionReason
          });
          break;


        case 'payment':
          response = await fetchNui('mdt:forcePayment', {
            job_name: selectedSociety.job_name
          });
          break;

        case 'export':
          response = await fetchNui<{ ok: boolean; data: ExportData }>('mdt:exportCompanyData', {
            job_name: selectedSociety.job_name
          });
          if (response.ok && response.data) {
            setExportData(response.data);
            setShowExportModal(true);
          }
          break;

        default:
          response = { ok: false };
      }

      if (response.ok) {
        setShowActionModal(false);
        setSelectedSociety(null);
        setActionType(null);
        loadData();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const handleUnfreeze = async (society: Society) => {
    setIsActioning(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:unfreezeCompany', {
        job_name: society.job_name
      });
      if (response.ok) {
        loadData();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const loadHistory = async (society: Society) => {
    try {
      const response = await fetchNui<{ ok: boolean; history: DojAction[] }>('mdt:getCompanyDojHistory', {
        job_name: society.job_name
      });
      if (response.ok) {
        setHistoryData(response.history ?? []);
        setSelectedSociety(society);
        setShowHistoryModal(true);
      }
    } catch {
      // ignore
    }
  };

  const filteredSocieties = societies.filter((s) =>
    s.label.toLowerCase().includes(search.toLowerCase()) ||
    s.job_name.toLowerCase().includes(search.toLowerCase())
  );

  const actionLabels: Record<string, string> = {
    fine: 'Amende',
    freeze: 'Gel',
    force_payment: 'Paiement force',
    export: 'Export'
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Chargement des donnees DOJ...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-2xl">Controle fiscal DOJ</h2>
        <p className="text-white/50">Gestion globale des taxes, audits et sanctions RP.</p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-4 gap-6">
        {[
          { label: 'Taxes generees', value: currency.format(stats?.totalTaxesGenerated ?? 0) },
          { label: 'Taxes en attente', value: currency.format(stats?.totalTaxesPending ?? 0) },
          { label: 'Societes', value: stats?.societiesCount ?? 0 },
          { label: 'Solde DOJ', value: currency.format(stats?.dojBalance ?? 0) }
        ].map((metric) => (
          <div key={metric.label} className="glass-panel rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">{metric.label}</p>
            <p className="mt-3 font-display text-3xl">{metric.value}</p>
          </div>
        ))}
      </section>

      {/* Alerts */}
      <section className="grid grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Entreprises gelees</p>
          <p className="mt-3 font-display text-3xl text-red-400">{stats?.frozenCount ?? 0}</p>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Amendes actives</p>
          <p className="mt-3 font-display text-3xl text-orange-400">{currency.format(stats?.activeFines ?? 0)}</p>
        </div>
      </section>

      {/* Societies List */}
      <section className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg">Toutes les societes</h3>
          <div className="flex gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
              placeholder="Rechercher une entreprise..."
            />
            <button
              onClick={loadData}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
            >
              Actualiser
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-6 py-4">Entreprise</th>
                <th className="px-6 py-4">Solde</th>
                <th className="px-6 py-4">Taxes dues</th>
                <th className="px-6 py-4">Factures</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSocieties.map((society) => (
                <tr key={society.job_name} className="border-t border-white/5">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium">{society.label}</p>
                      <p className="text-xs text-white/40">{society.job_name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-accent-500">{currency.format(society.money)}</td>
                  <td className="px-6 py-4">
                    <span className={society.taxes_pending > 0 ? 'text-orange-400' : 'text-white/60'}>
                      {currency.format(society.taxes_pending)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white/60">{society.invoice_count}</td>
                  <td className="px-6 py-4">
                    {society.is_frozen ? (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-400">
                        Gelee
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-400">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => openActionModal(society, 'fine')}
                        disabled={isActioning}
                        className="rounded-full bg-orange-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        title="Amende"
                      >
                        Amende
                      </button>
                      {society.is_frozen ? (
                        <button
                          onClick={() => handleUnfreeze(society)}
                          disabled={isActioning}
                          className="rounded-full bg-green-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                          title="Degeler"
                        >
                          Degeler
                        </button>
                      ) : (
                        <button
                          onClick={() => openActionModal(society, 'freeze')}
                          disabled={isActioning}
                          className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                          title="Geler"
                        >
                          Geler
                        </button>
                      )}
                      {society.taxes_pending > 0 && (
                        <button
                          onClick={() => openActionModal(society, 'payment')}
                          disabled={isActioning}
                          className="rounded-full bg-accent-600 px-2 py-1 text-xs text-base-950 disabled:opacity-50"
                          title="Forcer paiement"
                        >
                          Paiement
                        </button>
                      )}
                      <button
                        onClick={() => openActionModal(society, 'export')}
                        disabled={isActioning}
                        className="rounded-full border border-white/10 px-2 py-1 text-xs disabled:opacity-50"
                        title="Exporter donnees"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => loadHistory(society)}
                        className="rounded-full border border-white/10 px-2 py-1 text-xs"
                        title="Historique"
                      >
                        Historique
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSocieties.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-white/50">
                    Aucune societe trouvee
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Action Modal */}
      {showActionModal && selectedSociety && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display text-lg">
              {actionType === 'fine' && 'Amende'}
              {actionType === 'freeze' && 'Geler l\'entreprise'}
              {actionType === 'payment' && 'Forcer le paiement'}
              {actionType === 'export' && 'Exporter les donnees'}
            </h3>
            <p className="text-sm text-white/50">{selectedSociety.label}</p>

            <div className="mt-4 space-y-3">
              {actionType === 'fine' && (
                <>
                  <div>
                    <label className="text-xs text-white/50">Montant de l'amende</label>
                    <input
                      value={actionAmount}
                      onChange={(e) => setActionAmount(e.target.value.replace(/\D/g, ''))}
                      className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                      placeholder="Ex: 50000"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50">Raison</label>
                    <input
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                      placeholder="Raison de l'amende..."
                    />
                  </div>
                </>
              )}

              {actionType === 'freeze' && (
                <div>
                  <label className="text-xs text-white/50">Raison du gel</label>
                  <input
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                    placeholder="Raison du gel de l'entreprise..."
                  />
                </div>
              )}


              {actionType === 'payment' && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50">Taxes en attente</p>
                  <p className="mt-1 font-display text-2xl text-accent-500">
                    {currency.format(selectedSociety.taxes_pending)}
                  </p>
                  <p className="mt-2 text-xs text-white/40">
                    Ce montant sera preleve sur le compte de la societe et transfere au DOJ.
                  </p>
                </div>
              )}

              {actionType === 'export' && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-white/70">
                    Cette action va exporter toutes les donnees de l'entreprise:
                  </p>
                  <ul className="mt-2 list-disc list-inside text-xs text-white/50">
                    <li>Solde et informations generales</li>
                    <li>Liste des employes</li>
                    <li>Historique des factures</li>
                    <li>Actions DOJ precedentes</li>
                    <li>Partenariats</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowActionModal(false);
                  setSelectedSociety(null);
                  setActionType(null);
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={handleAction}
                disabled={
                  isActioning ||
                  (actionType === 'fine' && (!actionAmount || !actionReason)) ||
                  (actionType === 'freeze' && !actionReason)
                }
                className="rounded-full bg-accent-600 px-4 py-2 text-sm text-base-950 disabled:opacity-50"
              >
                {isActioning ? 'En cours...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedSociety && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6">
            <h3 className="font-display text-lg">Historique DOJ - {selectedSociety.label}</h3>

            <div className="mt-4 max-h-96 overflow-y-auto">
              {historyData.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
                    <tr>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Montant</th>
                      <th className="px-4 py-3">Raison</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((action) => (
                      <tr key={action.id} className="border-t border-white/5">
                        <td className="px-4 py-3 font-medium">
                          {actionLabels[action.action_type] || action.action_type}
                        </td>
                        <td className="px-4 py-3">
                          {action.amount > 0 ? currency.format(action.amount) : '—'}
                        </td>
                        <td className="px-4 py-3 text-white/60">{action.reason || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs ${
                            action.status === 'active' ? 'bg-red-500/20 text-red-400' :
                            action.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            action.status === 'resolved' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {action.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/40">{action.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-white/50 py-8">Aucun historique DOJ pour cette entreprise</p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryData([]);
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && exportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel w-full max-w-3xl rounded-2xl p-6">
            <h3 className="font-display text-lg">Export - {exportData.job_name}</h3>
            <p className="text-sm text-white/50">Exporte le {exportData.exported_at} par {exportData.exported_by}</p>

            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-base-900 p-4">
              <pre className="text-xs text-white/70 whitespace-pre-wrap">
                {JSON.stringify(exportData, null, 2)}
              </pre>
            </div>

            <div className="mt-4 flex justify-between">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `export_${exportData.job_name}_${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-full bg-accent-600 px-4 py-2 text-sm text-base-950"
              >
                Telecharger JSON
              </button>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportData(null);
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Taxes;
