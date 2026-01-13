import { useEffect, useState, useCallback } from 'react';
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
  id: string;
  model: string;
  name: string;
  price: number;
  plate: string;
  stock: number;
  category?: string;
};

type NearbyPlayer = {
  id: number;
  name: string;
  identifier: string;
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderingModel, setOrderingModel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'stock' | 'assign'>('catalog');
  const [selectedVehicle, setSelectedVehicle] = useState<StockVehicle | null>(null);
  const { player } = usePlayerStore();

  // Attribution state
  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [targetPlayerName, setTargetPlayerName] = useState('');
  const [targetIdentifier, setTargetIdentifier] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadData();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'dealership') {
        loadData();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadData]);

  const handleScanNearby = async () => {
    setIsScanning(true);
    try {
      const response = await fetchNui<{ ok: boolean; players: NearbyPlayer[] }>('mdt:getNearbyPlayers');
      if (response.ok && response.players?.length > 0) {
        setNearbyPlayers(response.players);
        const closest = response.players[0];
        setTargetPlayerId(String(closest.id));
        setTargetPlayerName(closest.name);
        setTargetIdentifier(closest.identifier);
      } else {
        setNearbyPlayers([]);
      }
    } catch {
      // ignore
    }
    setIsScanning(false);
  };

  const handleValidatePlayerId = async () => {
    if (!targetPlayerId) return;
    try {
      const response = await fetchNui<{ ok: boolean; player?: NearbyPlayer }>('mdt:getPlayerById', {
        playerId: Number(targetPlayerId)
      });
      if (response.ok && response.player) {
        setTargetPlayerName(response.player.name);
        setTargetIdentifier(response.player.identifier);
      }
    } catch {
      // ignore
    }
  };

  const handleOrder = async (vehicle: Vehicle) => {
    const societyPrice = Math.floor(vehicle.price * 0.6);
    if (societyMoney < societyPrice) return;

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

  const handleAssign = async () => {
    if (!selectedVehicle || !targetIdentifier) return;

    setIsAssigning(true);
    try {
      const response = await fetchNui<{ ok: boolean; plate?: string }>('mdt:assignVehicle', {
        model: selectedVehicle.model,
        targetIdentifier: targetIdentifier,
        targetName: targetPlayerName,
        targetPlayerId: targetPlayerId ? Number(targetPlayerId) : null
      });

      if (response.ok) {
        setSelectedVehicle(null);
        setTargetPlayerId('');
        setTargetPlayerName('');
        setTargetIdentifier('');
        setNearbyPlayers([]);
        loadData();
      }
    } catch {
      // ignore
    }
    setIsAssigning(false);
  };

  // Get unique categories
  const categories = [...new Set(vehicles.map((v) => v.category))].sort();

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    if (selectedCategory && v.category !== selectedCategory) return false;
    if (search) {
      return (
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.model.toLowerCase().includes(search.toLowerCase()) ||
        v.category.toLowerCase().includes(search.toLowerCase())
      );
    }
    return true;
  });

  const filteredStock = stock.filter((v) => {
    if (search) {
      return (
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.model.toLowerCase().includes(search.toLowerCase())
      );
    }
    return true;
  });

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
          <h3 className="font-display text-xl">Acces refuse</h3>
          <p className="text-white/50 mt-2">Cette section est reservee aux concessionnaires.</p>
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
          <p className="text-white/50">Catalogue vehicules + achats societe (-40%).</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-full border border-white/10 bg-surface-800 px-4 py-2 text-sm">
            <span className="text-white/50">Solde societe: </span>
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

      {/* Search and Categories */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Rechercher un vehicule..."
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Category filters */}
        {activeTab === 'catalog' && categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`rounded-full px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                selectedCategory === null
                  ? 'bg-accent-600 text-base-950 font-medium'
                  : 'border border-white/10 text-white/60 hover:bg-white/5'
              }`}
            >
              Toutes
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                  selectedCategory === cat
                    ? 'bg-accent-600 text-base-950 font-medium'
                    : 'border border-white/10 text-white/60 hover:bg-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
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
                    <span>Prix societe (-40%)</span>
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
                    ? 'Commander pour la societe'
                    : 'Fonds insuffisants'}
                </button>
              </div>
            );
          })}
          {filteredVehicles.length === 0 && (
            <div className="col-span-3 text-center text-white/50 py-12">
              Aucun vehicule trouve.
            </div>
          )}
        </section>
      )}

      {/* Stock Tab */}
      {activeTab === 'stock' && (
        <section className="glass-panel rounded-2xl p-6">
          <h3 className="font-display text-lg mb-4">Stock actuel ({stock.length} vehicules)</h3>
          {stock.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-white/5">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
                  <tr>
                    <th className="px-6 py-4">Vehicule</th>
                    <th className="px-6 py-4">Modele</th>
                    <th className="px-6 py-4">Plaque</th>
                    <th className="px-6 py-4">Quantite</th>
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
              Aucun vehicule en stock. Commandez depuis le catalogue.
            </div>
          )}
        </section>
      )}

      {/* Assign Tab */}
      {activeTab === 'assign' && (
        <section className="glass-panel rounded-2xl p-6">
          <h3 className="font-display text-lg mb-4">Attribution de vehicule</h3>

          {/* Vehicle selection */}
          {!selectedVehicle ? (
            <div>
              <p className="text-white/50 text-sm mb-4">
                Selectionnez un vehicule du stock pour l'attribuer a un client.
              </p>
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
                    Aucun vehicule disponible pour attribution.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Selected vehicle info */}
              <div className="rounded-2xl border border-accent-500/30 bg-accent-500/10 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-accent-400">Vehicule selectionne</p>
                    <p className="font-display text-2xl">{selectedVehicle.name}</p>
                    <p className="text-white/50">{selectedVehicle.model}</p>
                  </div>
                  <button
                    onClick={() => setSelectedVehicle(null)}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
                  >
                    Changer
                  </button>
                </div>
              </div>

              {/* Client selection */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-4">
                  Selectionnez le client
                </p>

                <div className="space-y-4">
                  <button
                    onClick={handleScanNearby}
                    disabled={isScanning}
                    className="w-full rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                  >
                    {isScanning ? 'Scan en cours...' : 'Scanner les joueurs a proximite'}
                  </button>

                  {nearbyPlayers.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-base-900">
                      {nearbyPlayers.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setTargetPlayerId(String(p.id));
                            setTargetPlayerName(p.name);
                            setTargetIdentifier(p.identifier);
                          }}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-white/5 border-b border-white/5 last:border-0 ${
                            targetIdentifier === p.identifier ? 'bg-accent-500/20' : ''
                          }`}
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-white/50 ml-2">(ID: {p.id})</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      value={targetPlayerId}
                      onChange={(e) => setTargetPlayerId(e.target.value)}
                      className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                      placeholder="Ou saisir ID joueur"
                    />
                    <button
                      onClick={handleValidatePlayerId}
                      className="rounded-full border border-white/10 px-4 py-2 text-xs hover:bg-white/5"
                    >
                      Valider
                    </button>
                  </div>

                  {targetPlayerName && (
                    <p className="text-sm text-accent-500">
                      Client selectionne: {targetPlayerName}
                    </p>
                  )}
                </div>
              </div>

              {/* Confirm button */}
              <div className="flex gap-3">
                <button
                  onClick={handleAssign}
                  disabled={isAssigning || !targetIdentifier}
                  className="flex-1 rounded-full bg-accent-600 py-3 text-sm font-medium text-base-950 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAssigning ? 'Attribution en cours...' : 'Confirmer l\'attribution'}
                </button>
                <button
                  onClick={() => {
                    setSelectedVehicle(null);
                    setTargetPlayerId('');
                    setTargetPlayerName('');
                    setTargetIdentifier('');
                    setNearbyPlayers([]);
                  }}
                  className="rounded-full border border-white/10 px-6 py-3 text-sm text-white/70 hover:bg-white/5"
                >
                  Annuler
                </button>
              </div>

              {!targetIdentifier && (
                <p className="text-xs text-orange-400 text-center">
                  Selectionnez un client pour attribuer le vehicule
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Stats section */}
      <section className="glass-panel rounded-2xl p-6">
        <h3 className="font-display text-lg">Statistiques concession</h3>
        <div className="mt-4 grid grid-cols-4 gap-4">
          {[
            { label: 'Solde societe', value: formatMoney(societyMoney), icon: 'money' },
            { label: 'Vehicules en stock', value: String(stock.reduce((sum, v) => sum + v.stock, 0)), icon: 'box' },
            { label: 'Modeles disponibles', value: String(vehicles.length), icon: 'car' },
            { label: 'Categories', value: String(categories.length), icon: 'tag' }
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/20 text-accent-400">
                  <Icon name={metric.icon} />
                </div>
                <div>
                  <p className="text-xs text-white/50">{metric.label}</p>
                  <p className="font-display text-lg">{metric.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dealership;
