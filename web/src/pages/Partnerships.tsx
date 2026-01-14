import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';

type PartnershipRow = {
  id: number;
  partner_name: string;
  discount_rate: number;
  status: string;
  notes?: string;
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const Partnerships = () => {
  const { player } = usePlayerStore();
  const [rows, setRows] = useState<PartnershipRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPartnership, setEditingPartnership] = useState<PartnershipRow | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDiscount, setFormDiscount] = useState('');
  const [formStatus, setFormStatus] = useState('active');
  const [formNotes, setFormNotes] = useState('');

  const isBoss = player?.isBoss ?? false;

  const loadPartnerships = async () => {
    setIsLoading(true);
    try {
      const response = await fetchNui<{ ok: boolean; partnerships: PartnershipRow[] }>('mdt:getPartnerships');
      if (response.ok) {
        setRows(response.partnerships ?? []);
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadPartnerships();
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'partnerships') {
        loadPartnerships();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const openCreateModal = () => {
    setEditingPartnership(null);
    setFormName('');
    setFormDiscount('');
    setFormStatus('active');
    setFormNotes('');
    setShowModal(true);
  };

  const openEditModal = (partnership: PartnershipRow) => {
    setEditingPartnership(partnership);
    setFormName(partnership.partner_name);
    setFormDiscount(String(Math.round(partnership.discount_rate * 100)));
    setFormStatus(partnership.status);
    setFormNotes(partnership.notes || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formDiscount) return;
    setIsActioning(true);
    try {
      const payload = {
        id: editingPartnership?.id,
        partner_name: formName,
        discount_rate: parseInt(formDiscount, 10) / 100,
        status: formStatus,
        notes: formNotes
      };
      const response = await fetchNui<{ ok: boolean }>('mdt:savePartnership', payload);
      if (response.ok) {
        setShowModal(false);
        setEditingPartnership(null);
        loadPartnerships();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
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

  const activeCount = rows.filter((r) => r.status === 'active').length;
  const avgDiscount = rows.length > 0
    ? formatPercent(rows.reduce((sum, r) => sum + r.discount_rate, 0) / rows.length)
    : '0%';

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Chargement des partenariats...
      </div>
    );
  }

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
            onClick={openCreateModal}
            className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 shadow-soft"
          >
            Nouveau partenariat
          </button>
        )}
      </header>

      <section className="grid grid-cols-3 gap-6">
        {[
          { label: 'Partenariats actifs', value: activeCount },
          { label: 'Reduction moyenne', value: avgDiscount },
          { label: 'Total partenariats', value: rows.length }
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
            {(['all', 'active', 'pending'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                  filter === f
                    ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                    : 'border-white/10 text-white/60 hover:bg-white/5'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'En attente'}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Recherche entreprise..."
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-6 py-4">Entreprise</th>
                <th className="px-6 py-4">Reduction</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Notes</th>
                {isBoss && <th className="px-6 py-4">Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((partnership) => (
                <tr key={partnership.id} className="border-t border-white/5">
                  <td className="px-6 py-4 font-medium">{partnership.partner_name}</td>
                  <td className="px-6 py-4 text-accent-500">
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
                  <td className="px-6 py-4 text-white/60">{partnership.notes || '—'}</td>
                  {isBoss && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openEditModal(partnership)}
                        className="text-accent-500 transition hover:text-accent-600"
                      >
                        Modifier
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={isBoss ? 5 : 4} className="px-6 py-8 text-center text-white/50">
                    Aucun partenariat trouve
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display text-lg">
              {editingPartnership ? 'Modifier le partenariat' : 'Nouveau partenariat'}
            </h3>
            <p className="text-sm text-white/50">
              {editingPartnership ? 'Modifiez les details du partenariat.' : 'Creez un nouveau partenariat entreprise.'}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-white/50">Nom de l'entreprise</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                  placeholder="Ex: Bennys Customs"
                />
              </div>

              <div>
                <label className="text-xs text-white/50">Reduction (%)</label>
                <input
                  value={formDiscount}
                  onChange={(e) => setFormDiscount(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                  placeholder="Ex: 10"
                />
              </div>

              <div>
                <label className="text-xs text-white/50">Statut</label>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => setFormStatus('active')}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      formStatus === 'active'
                        ? 'border-green-500 bg-green-500/20 text-green-400'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    Actif
                  </button>
                  <button
                    onClick={() => setFormStatus('pending')}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      formStatus === 'pending'
                        ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    En attente
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50">Notes (optionnel)</label>
                <input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                  placeholder="Notes sur le partenariat..."
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingPartnership(null);
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!formName || !formDiscount || isActioning}
                className="rounded-full bg-accent-600 px-4 py-2 text-sm text-base-950 disabled:opacity-50"
              >
                {isActioning ? 'Enregistrement...' : editingPartnership ? 'Modifier' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Partnerships;
