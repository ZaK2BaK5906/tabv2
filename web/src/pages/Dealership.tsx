import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';
import Icon from '../components/Icon';

type Vehicle = {
  model: string;
  name: string;
  price: number;
  category: string;
  stock: number;
};

type StockVehicle = {
  id: string; // model is used as ID
  model: string;
  name: string;
  price: number;
  plate: string;
  stock: number;
};

const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('$US', '$');
};

const Dealership = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stock, setStock] = useState<StockVehicle[]>([]);
  const [societyMoney, setSocietyMoney] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orderingModel, setOrderingModel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'stock' | 'assign'>('catalog');
  const [selectedVehicle, setSelectedVehicle] = useState<StockVehicle | null>(null);
  const { player } = usePlayerStore();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [vehiclesRes, stockRes, moneyRes] = await Promise.all([
        fetchNui<{ ok: boolean; vehicles: Vehicle[] }>('mdt:getVehicleCatalog'),
        fetchNui<{ ok: boolean; stock: StockVehicle[] }>('mdt:getDealershipStock'),
        fetchNui<{ ok: boolean; money: number }>('mdt:getSocietyMoney')
      ]);

      if (vehiclesRes.ok) setVehicles(vehiclesRes.vehicles ?? []);
      if (stockRes.ok) setStock(stockRes.stock ?? []);
      if (moneyRes.ok) setSocietyMoney(moneyRes.money ?? 0);
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'dealership') {
        loadData();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleOrder = async (vehicle: Vehicle) => {
    const societyPrice = Math.floor(vehicle.price * 0.6);
    if (societyMoney < societyPrice) {
      return;
    }

    setOrderingModel(vehicle.model);
    try {
      const response = await fetchNui<{ ok: boolean; reason?: string }>('mdt:orderVehicle', {
        model: vehicle.model,
        name: vehicle.name,
        price: societyPrice
      });

      if (response.ok) {
        loadData();
      }
    } catch {
      // ignore
    }
    setOrderingModel(null);
  };

  const handleAssign = async (vehicle: StockVehicle) => {
    try {
      const response = await fetchNui<{ ok: boolean; plate?: string }>('mdt:assignVehicle', {
        model: vehicle.model
      });

      if (response.ok) {
        setSelectedVehicle(null);
        loadData();
      }
    } catch {
      // ignore
    }
  };

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase())
  );

  const filteredStock = stock.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase())
  );

  // Check if player is dealership
  const isDealership = player?.job?.name === 'dealership' || player?.job?.name === 'cardealer';

  if (!isDealership) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
              <Icon name="lock" />
            </div>
          </div>
          <h3 className="font-display text-xl">Accès refusé</h3>
          <p className="text-white/50 mt-2">Cette section est réservée aux concessionnaires.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Chargement du catalogue...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Module Concessionnaire</h2>
          <p className="text-white/50">Catalogue véhicules + achats société (-40%).</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-full border border-white/10 bg-surface-800 px-4 py-2 text-sm">
            <span className="text-white/50">Solde société: </span>
            <span className="font-medium text-accent-500">{formatMoney(societyMoney)}</span>
          </div>
          <button
            onClick={loadData}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
          >
            Actualiser
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'catalog' as const, label: 'Catalogue', icon: 'car' },
          { id: 'stock' as const, label: 'Stock', icon: 'box' },
          { id: 'assign' as const, label: 'Attribution', icon: 'user-plus' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm transition ${
              activeTab === tab.id
                ? 'bg-accent-600 text-base-950 font-medium'
                : 'border border-white/10 text-white/70 hover:bg-white/5'
            }`}
          >
            <Icon name={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Rechercher un véhicule..."
          />
          <button
            onClick={() => setSearch('')}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
          >
            Effacer
          </button>
        </div>
      </div>

      {/* Catalog Tab */}
      {activeTab === 'catalog' && (
        <section className="grid grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => {
            const societyPrice = Math.floor(vehicle.price * 0.6);
            const canAfford = societyMoney >= societyPrice;

            return (
              <div key={vehicle.model} className="glass-panel rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">{vehicle.category}</p>
                    <p className="font-display text-xl">{vehicle.name}</p>
                    <p className="text-xs text-white/40">{vehicle.model}</p>
                  </div>
                  <div className="badge">Dispo</div>
                </div>
                <div className="mt-6 space-y-2 text-sm text-white/60">
                  <div className="flex items-center justify-between">
                    <span>Prix catalogue</span>
                    <span className="text-white line-through">{formatMoney(vehicle.price)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Prix société (-40%)</span>
                    <span className="text-accent-500 font-medium">{formatMoney(societyPrice)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleOrder(vehicle)}
                  disabled={!canAfford || orderingModel === vehicle.model}
                  className={`mt-6 w-full rounded-full py-2 text-sm font-medium transition ${
                    canAfford
                      ? 'bg-accent-600 text-base-950 hover:bg-accent-500'
                      : 'bg-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  {orderingModel === vehicle.model
                    ? 'Commande en cours...'
                    : canAfford
                    ? 'Commander pour la société'
                    : 'Fonds insuffisants'}
                </button>
              </div>
            );
          })}
          {filteredVehicles.length === 0 && (
            <div className="col-span-3 text-center text-white/50 py-12">
              Aucun véhicule trouvé.
            </div>
          )}
        </section>
      )}

      {/* Stock Tab */}
      {activeTab === 'stock' && (
        <section className="glass-panel rounded-2xl p-6">
          <h3 className="font-display text-lg mb-4">Stock actuel ({stock.length} véhicules)</h3>
          {stock.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-white/5">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
                  <tr>
                    <th className="px-6 py-4">Véhicule</th>
                    <th className="px-6 py-4">Modèle</th>
                    <th className="px-6 py-4">Plaque</th>
                    <th className="px-6 py-4">Quantité</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((vehicle) => (
                    <tr key={vehicle.id} className="border-t border-white/5">
                      <td className="px-6 py-4 font-medium">{vehicle.name}</td>
                      <td className="px-6 py-4 text-white/70">{vehicle.model}</td>
                      <td className="px-6 py-4 text-white/50">{vehicle.plate || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className="badge">{vehicle.stock}</span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedVehicle(vehicle);
                            setActiveTab('assign');
                          }}
                          className="rounded-full bg-accent-600 px-3 py-1 text-xs font-medium text-base-950"
                        >
                          Attribuer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-white/50 py-12">
              Aucun véhicule en stock. Commandez depuis le catalogue.
            </div>
          )}
        </section>
      )}

      {/* Assign Tab */}
      {activeTab === 'assign' && (
        <section className="glass-panel rounded-2xl p-6">
          <h3 className="font-display text-lg mb-4">Attribution de véhicule</h3>
          <p className="text-white/50 text-sm mb-6">
            Sélectionnez un véhicule du stock puis utilisez ox_target sur un joueur pour l'attribuer.
          </p>

          {selectedVehicle ? (
            <div className="rounded-2xl border border-accent-500/30 bg-accent-500/10 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-accent-400">Véhicule sélectionné</p>
                  <p className="font-display text-2xl">{selectedVehicle.name}</p>
                  <p className="text-white/50">{selectedVehicle.model}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAssign(selectedVehicle)}
                    className="rounded-full bg-accent-600 px-6 py-2 text-sm font-medium text-base-950"
                  >
                    Confirmer l'attribution
                  </button>
                  <button
                    onClick={() => setSelectedVehicle(null)}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {stock.map((vehicle) => (
                <button
                  key={vehicle.id}
                  onClick={() => setSelectedVehicle(vehicle)}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-accent-500/50 hover:bg-accent-500/10"
                >
                  <p className="font-medium">{vehicle.name}</p>
                  <p className="text-sm text-white/50">{vehicle.model}</p>
                  <p className="text-xs text-white/30 mt-2">Stock: {vehicle.stock}</p>
                </button>
              ))}
              {stock.length === 0 && (
                <div className="col-span-3 text-center text-white/50 py-12">
                  Aucun véhicule disponible pour attribution.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Stats section */}
      <section className="glass-panel rounded-2xl p-6">
        <h3 className="font-display text-lg">Statistiques concession</h3>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[
            { label: 'Solde société', value: formatMoney(societyMoney) },
            { label: 'Véhicules en stock', value: String(stock.reduce((sum, v) => sum + v.stock, 0)) },
            { label: 'Modèles disponibles', value: String(vehicles.length) }
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">{metric.label}</p>
              <p className="mt-2 font-display text-xl">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dealership;
