import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';

type Product = {
  id: number;
  label: string;
  price: number;
  status: string;
  description?: string;
};

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const Products = () => {
  const { player } = usePlayerStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetchNui<{ ok: boolean; products: Product[] }>('mdt:getProducts');
      if (response.ok) {
        setProducts(response.products ?? []);
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadProducts();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'products') {
        loadProducts();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleSave = async (asDraft: boolean = false) => {
    if (!formLabel || !formPrice) return;

    setIsSaving(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:saveProduct', {
        id: editingProduct?.id,
        label: formLabel,
        price: parseInt(formPrice, 10) || 0,
        description: formDescription,
        status: asDraft ? 'draft' : 'active'
      });

      if (response.ok) {
        resetForm();
        loadProducts();
      }
    } catch {
      // ignore
    }
    setIsSaving(false);
  };

  const handleDelete = async (productId: number) => {
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:deleteProduct', { id: productId });
      if (response.ok) {
        loadProducts();
      }
    } catch {
      // ignore
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormLabel(product.label);
    setFormPrice(String(product.price));
    setFormDescription(product.description ?? '');
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormLabel('');
    setFormPrice('');
    setFormDescription('');
  };

  // Filter products
  const filteredProducts = products.filter((product) => {
    if (filter === 'active' && product.status !== 'active') return false;
    if (filter === 'draft' && product.status !== 'draft') return false;
    if (search) {
      return product.label.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const activeCount = products.filter((p) => p.status === 'active').length;
  const isBoss = player?.isBoss ?? false;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Chargement des produits...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Catalogue produits</h2>
          <p className="text-white/50">
            {isBoss
              ? 'Le patron ajoute des produits et prix HT disponibles en facturation.'
              : 'Consultez les produits disponibles pour la facturation.'}
          </p>
        </div>
        {isBoss && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 shadow-soft"
          >
            Ajouter un produit
          </button>
        )}
      </header>

      {/* Add/Edit form */}
      {showForm && isBoss && (
        <section className="grid grid-cols-3 gap-6">
          <div className="glass-panel col-span-2 rounded-2xl p-6">
            <h3 className="font-display text-lg">
              {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                placeholder="Nom du produit"
              />
              <input
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                placeholder="Prix HT"
              />
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="col-span-2 h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 placeholder:text-white/30"
                placeholder="Description / notes internes"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => handleSave(false)}
                disabled={isSaving || !formLabel || !formPrice}
                className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 disabled:opacity-50"
              >
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving || !formLabel || !formPrice}
                className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 disabled:opacity-50"
              >
                Enregistrer en brouillon
              </button>
              <button
                onClick={resetForm}
                className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70"
              >
                Annuler
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <h3 className="font-display text-lg">Parametres</h3>
            <p className="text-sm text-white/50">Visibilite et regles de facturation.</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-white/60">Produits actifs</span>
                <span className="font-medium">{activeCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-white/60">Total produits</span>
                <span className="font-medium">{products.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-white/60">Validation patron</span>
                <span className="font-medium">Requise</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Product list */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {([
              { id: 'all', label: 'Tous' },
              { id: 'active', label: 'Actifs' },
              { id: 'draft', label: 'Brouillons' }
            ] as const).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full border px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                  filter === f.id
                    ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                    : 'border-white/10 text-white/60 hover:bg-white/5'
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
              placeholder="Recherche produit..."
            />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-6 py-4">Produit</th>
                <th className="px-6 py-4">Prix HT</th>
                <th className="px-6 py-4">Statut</th>
                {isBoss && <th className="px-6 py-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-t border-white/5">
                  <td className="px-6 py-4 font-medium">{product.label}</td>
                  <td className="px-6 py-4 text-white/70">{currency.format(product.price)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        product.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}
                    >
                      {product.status === 'active' ? 'Actif' : 'Brouillon'}
                    </span>
                  </td>
                  {isBoss && (
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-accent-500 transition hover:text-accent-600"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-400 transition hover:text-red-500"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={isBoss ? 4 : 3} className="px-6 py-8 text-center text-white/50">
                    Aucun produit trouve
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

export default Products;
