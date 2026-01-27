import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';

type PenalCategory = {
  id: number;
  name: string;
  label: string;
  description?: string;
  display_order: number;
};

type PenalArticle = {
  id: number;
  article_number: string;
  category: string;
  title: string;
  description: string;
  min_fine: number;
  max_fine: number;
  min_jail: number;
  max_jail: number;
  points: number;
  status: string;
  vote_status: string;
  votes_for: number;
  votes_against: number;
  vote_deadline?: string;
  created_at: string;
  myVote?: string;
};

type PenalStats = {
  totalArticles: number;
  activeArticles: number;
  votingArticles: number;
  totalVotes: number;
};

const formatMoney = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const PenalCode = () => {
  const { player } = usePlayerStore();
  const [categories, setCategories] = useState<PenalCategory[]>([]);
  const [articles, setArticles] = useState<PenalArticle[]>([]);
  const [stats, setStats] = useState<PenalStats | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDoj, setIsDoj] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<PenalArticle | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  // Form state
  const [form, setForm] = useState({
    article_number: '',
    category: 'infractions',
    title: '',
    description: '',
    min_fine: 0,
    max_fine: 0,
    min_jail: 0,
    max_jail: 0,
    points: 0,
    vote_days: 7
  });

  // Vote state
  const [voteComment, setVoteComment] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [catRes, artRes, statsRes] = await Promise.all([
        fetchNui<{ ok: boolean; categories: PenalCategory[] }>('mdt:getPenalCategories'),
        fetchNui<{ ok: boolean; articles: PenalArticle[]; isDoj: boolean }>('mdt:getPenalArticles', {
          category: selectedCategory !== 'all' ? selectedCategory : null,
          status: filterStatus !== 'all' ? filterStatus : null
        }),
        fetchNui<{ ok: boolean; stats: PenalStats }>('mdt:getPenalStats')
      ]);

      if (catRes.ok) setCategories(catRes.categories ?? []);
      if (artRes.ok) {
        setArticles(artRes.articles ?? []);
        setIsDoj(artRes.isDoj ?? false);
      }
      if (statsRes.ok) setStats(statsRes.stats);
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'penal') {
        loadData();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [selectedCategory, filterStatus]);

  const openCreateModal = () => {
    setForm({
      article_number: '',
      category: 'infractions',
      title: '',
      description: '',
      min_fine: 0,
      max_fine: 0,
      min_jail: 0,
      max_jail: 0,
      points: 0,
      vote_days: 7
    });
    setShowCreateModal(true);
  };

  const openDetailModal = async (article: PenalArticle) => {
    try {
      const response = await fetchNui<{ ok: boolean; article: PenalArticle }>('mdt:getPenalArticle', { id: article.id });
      if (response.ok) {
        setSelectedArticle(response.article);
        setVoteComment('');
        setShowDetailModal(true);
      }
    } catch {
      // ignore
    }
  };

  const handleCreate = async () => {
    if (!form.article_number || !form.title || !form.description) return;
    setIsActioning(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:createPenalArticle', form);
      if (response.ok) {
        setShowCreateModal(false);
        loadData();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const handleVote = async (vote: 'for' | 'against') => {
    if (!selectedArticle) return;
    setIsActioning(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:voteOnArticle', {
        article_id: selectedArticle.id,
        vote,
        comment: voteComment || null
      });
      if (response.ok) {
        // Refresh article details
        const detailRes = await fetchNui<{ ok: boolean; article: PenalArticle }>('mdt:getPenalArticle', { id: selectedArticle.id });
        if (detailRes.ok) {
          setSelectedArticle(detailRes.article);
        }
        loadData();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const handleValidate = async () => {
    if (!selectedArticle) return;
    setIsActioning(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:validatePenalArticle', { id: selectedArticle.id });
      if (response.ok) {
        setShowDetailModal(false);
        loadData();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const handleReject = async () => {
    if (!selectedArticle) return;
    setIsActioning(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:rejectPenalArticle', { id: selectedArticle.id });
      if (response.ok) {
        setShowDetailModal(false);
        loadData();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const handleDelete = async () => {
    if (!selectedArticle) return;
    setIsActioning(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:deletePenalArticle', { id: selectedArticle.id });
      if (response.ok) {
        setShowDetailModal(false);
        loadData();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const filteredArticles = articles.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.article_number.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryLabel = (name: string) => {
    const cat = categories.find((c) => c.name === name);
    return cat?.label || name;
  };

  const getStatusBadge = (article: PenalArticle) => {
    if (article.status === 'active') {
      return <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">En vigueur</span>;
    }
    if (article.vote_status === 'voting') {
      return <span className="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-400">Vote en cours</span>;
    }
    if (article.vote_status === 'rejected') {
      return <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs text-red-400">Rejete</span>;
    }
    return <span className="rounded-full bg-orange-500/20 px-2 py-1 text-xs text-orange-400">Brouillon</span>;
  };

  const isVoteExpired = (deadline?: string) => {
    if (!deadline) return false;
    return new Date() > new Date(deadline);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Chargement du Code Penal...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-2xl">Code Penal</h2>
        <p className="text-white/50">
          {isDoj ? 'Gestion des lois et validation des votes citoyens.' : 'Consultez les lois et votez pour les nouvelles propositions.'}
        </p>
      </header>

      {/* Stats */}
      {isDoj && stats && (
        <section className="grid grid-cols-4 gap-6">
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Articles totaux</p>
            <p className="mt-3 font-display text-3xl">{stats.totalArticles}</p>
          </div>
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">En vigueur</p>
            <p className="mt-3 font-display text-3xl text-green-400">{stats.activeArticles}</p>
          </div>
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">En vote</p>
            <p className="mt-3 font-display text-3xl text-blue-400">{stats.votingArticles}</p>
          </div>
          <div className="glass-panel rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Votes deposes</p>
            <p className="mt-3 font-display text-3xl">{stats.totalVotes}</p>
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
          >
            <option value="all">Toutes les categories</option>
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>{cat.label}</option>
            ))}
          </select>

          {isDoj && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
            >
              <option value="all">Tous les statuts</option>
              <option value="voting">En vote</option>
              <option value="approved">Approuves</option>
              <option value="rejected">Rejetes</option>
            </select>
          )}

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Rechercher un article..."
          />

          {isDoj && (
            <button
              onClick={openCreateModal}
              className="rounded-full bg-accent-600 px-4 py-2 text-sm font-medium text-base-950"
            >
              Nouvelle loi
            </button>
          )}
        </div>
      </section>

      {/* Articles List */}
      <section className="space-y-4">
        {filteredArticles.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-white/50">
            Aucun article trouve
          </div>
        ) : (
          filteredArticles.map((article) => (
            <div
              key={article.id}
              onClick={() => openDetailModal(article)}
              className="glass-panel cursor-pointer rounded-2xl p-6 transition hover:bg-white/5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-accent-600/20 px-3 py-1 text-xs font-medium text-accent-400">
                      Art. {article.article_number}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/50">
                      {getCategoryLabel(article.category)}
                    </span>
                    {getStatusBadge(article)}
                  </div>
                  <h3 className="mt-3 font-display text-lg">{article.title}</h3>
                  <p className="mt-1 text-sm text-white/60 line-clamp-2">{article.description}</p>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/50">
                    {(article.min_fine > 0 || article.max_fine > 0) && (
                      <span>Amende: {formatMoney(article.min_fine)} - {formatMoney(article.max_fine)}</span>
                    )}
                    {(article.min_jail > 0 || article.max_jail > 0) && (
                      <span>Prison: {article.min_jail} - {article.max_jail} mois</span>
                    )}
                    {article.points > 0 && <span>Points: -{article.points}</span>}
                  </div>
                </div>

                {article.vote_status === 'voting' && (
                  <div className="ml-4 text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">{article.votes_for}</span>
                      <span className="text-white/30">/</span>
                      <span className="text-red-400">{article.votes_against}</span>
                    </div>
                    <p className="mt-1 text-xs text-white/40">votes</p>
                    {article.vote_deadline && (
                      <p className={`mt-2 text-xs ${isVoteExpired(article.vote_deadline) ? 'text-red-400' : 'text-white/40'}`}>
                        {isVoteExpired(article.vote_deadline) ? 'Vote expire' : `Fin: ${new Date(article.vote_deadline).toLocaleDateString('fr-FR')}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
            <h3 className="font-display text-lg">Proposer une nouvelle loi</h3>
            <p className="text-sm text-white/50">Cette proposition sera soumise au vote des citoyens.</p>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50">Numero d'article</label>
                <input
                  value={form.article_number}
                  onChange={(e) => setForm({ ...form, article_number: e.target.value })}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                  placeholder="Ex: 1-1, 2-3..."
                />
              </div>
              <div>
                <label className="text-xs text-white/50">Categorie</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                >
                  {categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs text-white/50">Titre de la loi</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                placeholder="Ex: Vol a main armee"
              />
            </div>

            <div className="mt-4">
              <label className="text-xs text-white/50">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                placeholder="Decrivez l'infraction et les circonstances..."
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50">Amende min ($)</label>
                <input
                  type="number"
                  value={form.min_fine}
                  onChange={(e) => setForm({ ...form, min_fine: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                />
              </div>
              <div>
                <label className="text-xs text-white/50">Amende max ($)</label>
                <input
                  type="number"
                  value={form.max_fine}
                  onChange={(e) => setForm({ ...form, max_fine: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50">Prison min (mois)</label>
                <input
                  type="number"
                  value={form.min_jail}
                  onChange={(e) => setForm({ ...form, min_jail: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                />
              </div>
              <div>
                <label className="text-xs text-white/50">Prison max (mois)</label>
                <input
                  type="number"
                  value={form.max_jail}
                  onChange={(e) => setForm({ ...form, max_jail: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50">Points de permis</label>
                <input
                  type="number"
                  value={form.points}
                  onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                />
              </div>
              <div>
                <label className="text-xs text-white/50">Duree du vote (jours)</label>
                <input
                  type="number"
                  value={form.vote_days}
                  onChange={(e) => setForm({ ...form, vote_days: parseInt(e.target.value) || 7 })}
                  className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={isActioning || !form.article_number || !form.title || !form.description}
                className="rounded-full bg-accent-600 px-4 py-2 text-sm text-base-950 disabled:opacity-50"
              >
                {isActioning ? 'Creation...' : 'Soumettre au vote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-accent-600/20 px-3 py-1 text-xs font-medium text-accent-400">
                    Art. {selectedArticle.article_number}
                  </span>
                  {getStatusBadge(selectedArticle)}
                </div>
                <h3 className="mt-3 font-display text-xl">{selectedArticle.title}</h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="rounded-full border border-white/10 p-2 text-white/50 hover:bg-white/5"
              >
                X
              </button>
            </div>

            <p className="mt-4 text-sm text-white/70">{selectedArticle.description}</p>

            <div className="mt-6 grid grid-cols-3 gap-4">
              {(selectedArticle.min_fine > 0 || selectedArticle.max_fine > 0) && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50">Amende</p>
                  <p className="mt-1 font-display text-lg">
                    {formatMoney(selectedArticle.min_fine)} - {formatMoney(selectedArticle.max_fine)}
                  </p>
                </div>
              )}
              {(selectedArticle.min_jail > 0 || selectedArticle.max_jail > 0) && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50">Prison</p>
                  <p className="mt-1 font-display text-lg">
                    {selectedArticle.min_jail} - {selectedArticle.max_jail} mois
                  </p>
                </div>
              )}
              {selectedArticle.points > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50">Points</p>
                  <p className="mt-1 font-display text-lg text-red-400">-{selectedArticle.points}</p>
                </div>
              )}
            </div>

            {/* Vote Section */}
            {selectedArticle.vote_status === 'voting' && (
              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Vote citoyen</p>
                    {selectedArticle.vote_deadline && (
                      <p className={`text-xs ${isVoteExpired(selectedArticle.vote_deadline) ? 'text-red-400' : 'text-white/50'}`}>
                        {isVoteExpired(selectedArticle.vote_deadline)
                          ? 'Vote termine'
                          : `Fin du vote: ${new Date(selectedArticle.vote_deadline).toLocaleDateString('fr-FR')}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="font-display text-2xl text-green-400">{selectedArticle.votes_for}</p>
                      <p className="text-xs text-white/50">Pour</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-2xl text-red-400">{selectedArticle.votes_against}</p>
                      <p className="text-xs text-white/50">Contre</p>
                    </div>
                  </div>
                </div>

                {!isVoteExpired(selectedArticle.vote_deadline) && (
                  <div className="mt-4">
                    {selectedArticle.myVote ? (
                      <p className="text-sm text-white/60">
                        Vous avez vote: <span className={selectedArticle.myVote === 'for' ? 'text-green-400' : 'text-red-400'}>
                          {selectedArticle.myVote === 'for' ? 'Pour' : 'Contre'}
                        </span>
                      </p>
                    ) : (
                      <>
                        <textarea
                          value={voteComment}
                          onChange={(e) => setVoteComment(e.target.value)}
                          rows={2}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                          placeholder="Commentaire (optionnel)..."
                        />
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleVote('for')}
                            disabled={isActioning}
                            className="flex-1 rounded-full bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                          >
                            Voter Pour
                          </button>
                          <button
                            onClick={() => handleVote('against')}
                            disabled={isActioning}
                            className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                          >
                            Voter Contre
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* DOJ Actions */}
            {isDoj && selectedArticle.vote_status === 'voting' && (
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={handleValidate}
                  disabled={isActioning}
                  className="rounded-full bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Valider la loi
                </button>
                <button
                  onClick={handleReject}
                  disabled={isActioning}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Rejeter
                </button>
                {selectedArticle.status !== 'active' && (
                  <button
                    onClick={handleDelete}
                    disabled={isActioning}
                    className="rounded-full border border-red-500/50 px-4 py-2 text-sm text-red-400 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PenalCode;
