import { useEffect, useState, useCallback } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';
import Icon from '../components/Icon';

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
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [search, setSearch] = useState('');

  // Form state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadProducts = useCallback(() => {
    fetchNui<{ ok: boolean; products: Product[] }>('mdt:getProducts')
      .then((response) => {
        if (response.ok) {
          setProducts(response.products ?? []);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadProducts();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'products') {
        loadProducts();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadProducts]);

  const handleSave = async (asDraft: boolean = false) => {
    if (!newLabel || !newPrice) return;

    setIsSaving(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:saveProduct', {
        id: editingProduct?.id ?? null,
        label: newLabel,
        price: Number(newPrice),
        description: newDescription,
        status: asDraft ? 'draft' : 'active'
      });

      if (response.ok) {
        setNewLabel('');
        setNewPrice('');
        setNewDescription('');
        setEditingProduct(null);
        loadProducts();
      }
    } catch {
      // ignore
    }
    setIsSaving(false);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setNewLabel(product.label);
    setNewPrice(String(product.price));
    setNewDescription(product.description ?? '');
  };

  const handleDelete = async (productId: number) => {
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:deleteProduct', {
        id: productId
      });
      if (response.ok) {
        loadProducts();
      }
    } catch {
      // ignore
    }
  };

  const handleCancel = () => {
    setEditingProduct(null);
    setNewLabel('');
    setNewPrice('');
    setNewDescription('');
  };

  // Filter products
  const filteredProducts = products.filter((prod) => {
    if (filter === 'active' && prod.status !== 'active') return false;
    if (filter === 'draft' && prod.status !== 'draft') return false;

    if (search) {
      return prod.label.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const activeCount = products.filter((p) => p.status === 'active').length;

  // Check if user is boss
  const isBoss = player?.isBoss ?? false;

  if (!isBoss) {
    return (
      <div className="space-y-8">
        <header>
          <h2 className="font-display text-2xl">Catalogue produits</h2>
          <p className="text-white/50">
            Consultez les produits disponibles pour la facturation.
          </p>
        </header>

        <div className="glass-panel rounded-2xl p-6">
          {isLoading ? (
            <div className="text-center text-white/50 py-12">Chargement...</div>
          ) : products.length === 0 ? (
            <div className="text-center text-white/50 py-12">
              <Icon name="tag" />
              <p className="mt-2">Aucun produit disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {products.filter(p => p.status === 'active').map((product) => (
                <div key={product.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-medium">{product.label}</p>
                  <p className="text-lg text-accent-500 mt-2">{currency.format(product.price)}</p>
                  {product.description && (
                    <p className="text-sm text-white/50 mt-2">{product.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-2xl">Catalogue produits</h2>
        <p className="text-white/50">
          Gerez les produits et prix HT disponibles en facturation.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-6">
        <div className="glass-panel col-span-2 rounded-2xl p-6">
          <h3 className="font-display text-lg">
            {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
              placeholder="Nom du produit"
            />
            <input
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
              placeholder="Prix HT ($)"
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="col-span-2 h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 placeholder:text-white/30"
              placeholder="Description / notes internes"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={isSaving || !newLabel || !newPrice}
              className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSaving || !newLabel || !newPrice}
              className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 disabled:opacity-50"
            >
              Enregistrer en brouillon
            </button>
            {editingProduct && (
              <button
                onClick={handleCancel}
                className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70"
              >
                Annuler
              </button>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h3 className="font-display text-lg">Statistiques</h3>
          <p className="text-sm text-white/50">Apercu du catalogue.</p>
          <div className="mt-4 space-y-3 text-sm">
            {[
              { label: 'Produits actifs', value: String(activeCount) },
              { label: 'Total produits', value: String(products.length) },
              { label: 'Brouillons', value: String(products.filter(p => p.status === 'draft').length) }
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <span className="text-white/60">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[
              { id: 'all' as const, label: 'Tous' },
              { id: 'active' as const, label: 'Actifs' },
              { id: 'draft' as const, label: 'Brouillons' }
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
              placeholder="Recherche produit..."
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
        ) : filteredProducts.length === 0 ? (
          <div className="mt-6 text-center text-white/50 py-12">
            <div className="flex justify-center mb-2">
              <Icon name="tag" />
            </div>
            <p>Aucun produit trouve</p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
                <tr>
                  <th className="px-6 py-4">Produit</th>
                  <th className="px-6 py-4">Prix HT</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-t border-white/5">
                    <td className="px-6 py-4">
                      <p className="font-medium">{product.label}</p>
                      {product.description && (
                        <p className="text-xs text-white/40 mt-1">{product.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-accent-500">{currency.format(product.price)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs ${
                        product.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {product.status === 'active' ? 'Actif' : 'Brouillon'}
                      </span>
                    </td>
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

export default Products;
