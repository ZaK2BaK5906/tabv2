const products = [
  { label: 'Réparation moteur', price: '$1,200', status: 'Actif' },
  { label: 'Peinture complète', price: '$3,500', status: 'Actif' },
  { label: 'Alignement châssis', price: '$800', status: 'Brouillon' }
];

const Products = () => (
  <div className="space-y-8">
    <header className="flex items-center justify-between">
      <div>
        <h2 className="font-display text-2xl">Catalogue produits</h2>
        <p className="text-white/50">
          Le patron ajoute des produits et prix HT disponibles en facturation.
        </p>
      </div>
      <button className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950 shadow-soft">
        Ajouter un produit
      </button>
    </header>

    <section className="grid grid-cols-3 gap-6">
      <div className="glass-panel col-span-2 rounded-2xl p-6">
        <h3 className="font-display text-lg">Nouveau produit</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <input
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Nom du produit"
          />
          <input
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Prix HT"
          />
          <textarea
            className="col-span-2 h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Description / notes internes"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <button className="rounded-full bg-accent-600 px-5 py-2 text-sm font-medium text-base-950">
            Enregistrer
          </button>
          <button className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70">
            Enregistrer en brouillon
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <h3 className="font-display text-lg">Paramètres</h3>
        <p className="text-sm text-white/50">Visibilité et règles de facturation.</p>
        <div className="mt-4 space-y-3 text-sm">
          {[
            { label: 'Produits actifs', value: '12' },
            { label: 'Dernière mise à jour', value: 'Aujourd’hui' },
            { label: 'Validation patron', value: 'Requise' }
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
          {['Tous', 'Actifs', 'Brouillons'].map((filter) => (
            <button
              key={filter}
              className="rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-white/60 transition hover:bg-white/5"
            >
              {filter}
            </button>
          ))}
        </div>
        <input
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
          placeholder="Recherche produit..."
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
            <tr>
              <th className="px-6 py-4">Produit</th>
              <th className="px-6 py-4">Prix HT</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.label} className="border-t border-white/5">
                <td className="px-6 py-4 font-medium">{product.label}</td>
                <td className="px-6 py-4 text-white/70">{product.price}</td>
                <td className="px-6 py-4">
                  <span className="badge">{product.status}</span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-accent-500 transition hover:text-accent-600">
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default Products;
