import { useEffect, useState, useCallback } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';
import Icon from '../components/Icon';

type PartnershipRow = {
  id: number;
  partner_name: string;
  partner_job?: string;
  discount_rate: number;
  status: string;
  notes?: string;
  created_at?: string;
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const Partnerships = () => {
  const { player } = usePlayerStore();
  const [rows, setRows] = useState<PartnershipRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [search, setSearch] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPartnership, setEditingPartnership] = useState<PartnershipRow | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerJob, setPartnerJob] = useState('');
  const [discountRate, setDiscountRate] = useState('10');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadPartnerships = useCallback(() => {
    fetchNui<{ ok: boolean; partnerships: PartnershipRow[] }>('mdt:getPartnerships')
      .then((response) => {
        if (response.ok) {
          setRows(response.partnerships ?? []);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadPartnerships();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'partnerships') {
        loadPartnerships();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadPartnerships]);

  const handleOpenModal = (partnership?: PartnershipRow) => {
    if (partnership) {
      setEditingPartnership(partnership);
      setPartnerName(partnership.partner_name);
      setPartnerJob(partnership.partner_job ?? '');
      setDiscountRate(String(Math.round(partnership.discount_rate * 100)));
      setNotes(partnership.notes ?? '');
    } else {
      setEditingPartnership(null);
      setPartnerName('');
      setPartnerJob('');
      setDiscountRate('10');
      setNotes('');
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPartnership(null);
    setPartnerName('');
    setPartnerJob('');
    setDiscountRate('10');
    setNotes('');
  };

  const handleSave = async () => {
    if (!partnerName) return;

    setIsSaving(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:savePartnership', {
        id: editingPartnership?.id ?? null,
        partnerName,
        partnerJob,
        discountRate: Number(discountRate) / 100,
        notes,
        status: 'active'
      });

      if (response.ok) {
        handleCloseModal();
        loadPartnerships();
      }
    } catch {
      // ignore
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:deletePartnership', { id });
      if (response.ok) {
        loadPartnerships();
      }
    } catch {
      // ignore
    }
  };

  const handleToggleStatus = async (partnership: PartnershipRow) => {
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:togglePartnershipStatus', {
        id: partnership.id,
        status: partnership.status === 'active' ? 'pending' : 'active'
      });
      if (response.ok) {
        loadPartnerships();
      }
    } catch {
      // ignore
    }
  };

  // Filter partnerships
  const filteredRows = rows.filter((p) => {
    if (filter === 'active' && p.status !== 'active') return false;
    if (filter === 'pending' && p.status !== 'pending') return false;

    if (search) {
      return p.partner_name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const isBoss = player?.isBoss ?? false;
  const activeCount = rows.filter((r) => r.status === 'active').length;
  const avgDiscount = rows.length > 0
    ? rows.reduce((sum, r) => sum + r.discount_rate, 0) / rows.length
    : 0;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Partenariats entreprises</h2>
          <p className="text-white/50">
            Gerez les accords, reductions et clauses de facturation.
          </p>
        </div>
        {isBoss && (
          <button
            onClick={() => handleOpenModal()}
            className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 shadow-soft"
          >
            Nouveau partenariat
          </button>
        )}
      </header>

      <section className="grid grid-cols-3 gap-6">
        {[
          {
            label: 'Partenariats actifs',
            value: String(activeCount),
            icon: 'handshake',
            color: 'text-green-400 bg-green-500/20'
          },
          {
            label: 'Reduction moyenne',
            value: formatPercent(avgDiscount),
            icon: 'tag',
            color: 'text-accent-400 bg-accent-500/20'
          },
          {
            label: 'Total partenaires',
            value: String(rows.length),
            icon: 'users',
            color: 'text-blue-400 bg-blue-500/20'
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
              { id: 'all' as const, label: 'Tous' },
              { id: 'active' as const, label: 'Actifs' },
              { id: 'pending' as const, label: 'En attente' }
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
              placeholder="Recherche entreprise..."
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
        ) : filteredRows.length === 0 ? (
          <div className="mt-6 text-center text-white/50 py-12">
            <div className="flex justify-center mb-2">
              <Icon name="handshake" />
            </div>
            <p>Aucun partenariat trouve</p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
                <tr>
                  <th className="px-6 py-4">Entreprise</th>
                  <th className="px-6 py-4">Reduction</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Notes</th>
                  {isBoss && <th className="px-6 py-4">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((partnership) => (
                  <tr key={partnership.id} className="border-t border-white/5">
                    <td className="px-6 py-4">
                      <p className="font-medium">{partnership.partner_name}</p>
                      {partnership.partner_job && (
                        <p className="text-xs text-white/40">{partnership.partner_job}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-accent-500 font-medium">
                      {formatPercent(partnership.discount_rate)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs ${
                        partnership.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {partnership.status === 'active' ? 'Actif' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/60 max-w-xs truncate">
                      {partnership.notes || '-'}
                    </td>
                    {isBoss && (
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenModal(partnership)}
                            className="text-accent-500 transition hover:text-accent-600"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleToggleStatus(partnership)}
                            className="text-white/50 transition hover:text-white/70"
                          >
                            {partnership.status === 'active' ? 'Suspendre' : 'Activer'}
                          </button>
                          <button
                            onClick={() => handleDelete(partnership.id)}
                            className="text-red-400 transition hover:text-red-500"
                          >
                            Supprimer
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display text-xl">
              {editingPartnership ? 'Modifier le partenariat' : 'Nouveau partenariat'}
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Nom de l'entreprise
                </label>
                <input
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="mt-2 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                  placeholder="Ex: Benny's Customs"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Job (optionnel)
                </label>
                <input
                  value={partnerJob}
                  onChange={(e) => setPartnerJob(e.target.value)}
                  className="mt-2 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                  placeholder="Ex: mechanic"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Reduction (%)
                </label>
                <input
                  value={discountRate}
                  onChange={(e) => setDiscountRate(e.target.value.replace(/[^0-9]/g, ''))}
                  className="mt-2 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                  placeholder="10"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-2 w-full h-20 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 placeholder:text-white/30"
                  placeholder="Details du partenariat..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !partnerName}
                className="rounded-full bg-accent-600 px-4 py-2 text-sm font-medium text-base-950 disabled:opacity-50"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Partnerships;
