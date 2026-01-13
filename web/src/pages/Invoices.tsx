import { useEffect, useState, useCallback } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';
import Icon from '../components/Icon';

type InvoiceRow = {
  invoice_id: string;
  job_name: string;
  issuer_name: string;
  target_name?: string;
  target_identifier?: string;
  mode: string;
  product_label: string;
  amount_ht: number;
  tax_rate: number;
  tax_amount: number;
  total_ttc: number;
  status: string;
  tax_free_reason?: string;
  created_at: string;
};

type Product = {
  id: number;
  label: string;
  price: number;
};

type NearbyPlayer = {
  id: number;
  name: string;
  identifier: string;
};

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const formatTax = (rate: number) => (rate > 0 ? `${Math.round(rate * 100)}%` : 'Sans taxe');

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

type InvoiceMode = 'citoyen' | 'entreprise' | 'paiement_citoyen';

const Invoices = () => {
  const { player } = usePlayerStore();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'tax_free'>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Invoice creation state
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>('citoyen');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [targetPlayerName, setTargetPlayerName] = useState('');
  const [targetIdentifier, setTargetIdentifier] = useState('');
  const [isTaxFree, setIsTaxFree] = useState(false);
  const [taxFreeReason, setTaxFreeReason] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Tax settings
  const [taxRate, setTaxRate] = useState(0.15);

  const loadInvoices = useCallback(() => {
    fetchNui<{ ok: boolean; invoices: InvoiceRow[] }>('mdt:getInvoices')
      .then((response) => {
        if (response.ok) {
          setRows(response.invoices ?? []);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  const loadProducts = useCallback(() => {
    fetchNui<{ ok: boolean; products: Product[] }>('mdt:getProducts')
      .then((response) => {
        if (response.ok) {
          setProducts(response.products ?? []);
        }
      })
      .catch(() => undefined);
  }, []);

  const loadTaxSettings = useCallback(() => {
    fetchNui<{ ok: boolean; taxes: { defaultRate: number } }>('mdt:getTaxSettings')
      .then((response) => {
        if (response.ok) {
          setTaxRate(response.taxes.defaultRate ?? 0.15);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadInvoices();
    loadProducts();
    loadTaxSettings();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated') {
        if (event.data?.entity === 'invoices') loadInvoices();
        if (event.data?.entity === 'products') loadProducts();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadInvoices, loadProducts, loadTaxSettings]);

  // Calculate preview values
  const amountHT = useCustomPrice
    ? Number(customPrice) || 0
    : selectedProduct?.price ?? 0;

  const currentTaxRate = isTaxFree ? 0 : taxRate;
  const taxAmount = Math.round(amountHT * currentTaxRate);
  const totalTTC = amountHT + taxAmount;

  const handleScanNearby = async () => {
    setIsScanning(true);
    try {
      const response = await fetchNui<{ ok: boolean; players: NearbyPlayer[] }>('mdt:getNearbyPlayers');
      if (response.ok && response.players?.length > 0) {
        setNearbyPlayers(response.players);
        // Auto-select closest player
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

  const handleSendInvoice = async () => {
    const productLabel = useCustomPrice ? customLabel : selectedProduct?.label;
    if (!productLabel || amountHT <= 0) return;
    if (!targetIdentifier && invoiceMode === 'citoyen') return;

    setIsSending(true);
    try {
      const response = await fetchNui<{ ok: boolean; invoiceId?: string }>('mdt:createInvoice', {
        invoiceId: `INV-${Date.now()}`,
        mode: invoiceMode,
        product: productLabel,
        amount: amountHT,
        taxRate: currentTaxRate,
        taxAmount: taxAmount,
        total: totalTTC,
        issuer: player?.fullname ?? 'MDT',
        targetIdentifier: targetIdentifier || null,
        targetName: targetPlayerName || null,
        targetPlayerId: targetPlayerId ? Number(targetPlayerId) : null,
        taxFreeReason: isTaxFree ? taxFreeReason : null,
        status: 'pending',
        giveItem: false
      });

      if (response.ok) {
        // Reset form
        setSelectedProduct(null);
        setCustomLabel('');
        setCustomPrice('');
        setUseCustomPrice(false);
        setTargetPlayerId('');
        setTargetPlayerName('');
        setTargetIdentifier('');
        setIsTaxFree(false);
        setTaxFreeReason('');
        loadInvoices();
      }
    } catch {
      // ignore
    }
    setIsSending(false);
  };

  // Filter invoices
  const filteredInvoices = rows.filter((inv) => {
    // Status filter
    if (filter === 'paid' && inv.status !== 'paid') return false;
    if (filter === 'pending' && inv.status !== 'pending') return false;
    if (filter === 'tax_free' && inv.tax_rate > 0) return false;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        inv.invoice_id.toLowerCase().includes(searchLower) ||
        inv.target_name?.toLowerCase().includes(searchLower) ||
        inv.issuer_name.toLowerCase().includes(searchLower) ||
        inv.product_label.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const modeLabels: Record<InvoiceMode, string> = {
    citoyen: 'Facture client',
    entreprise: 'Facture entreprise',
    paiement_citoyen: 'Paiement citoyen'
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-2xl">Facturation clients</h2>
        <p className="text-white/50">
          Envoyez des factures aux citoyens et entreprises. TVA appliquee automatiquement.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-6">
        <div className="glass-panel col-span-2 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg">Creer une facture</h3>
              <p className="text-sm text-white/50">
                Client citoyen ou entreprise (paiement patron).
              </p>
            </div>
            <div className="flex gap-2">
              {(['citoyen', 'entreprise', 'paiement_citoyen'] as InvoiceMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInvoiceMode(mode)}
                  className={`rounded-full px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                    invoiceMode === mode
                      ? 'bg-accent-600 text-base-950 font-medium'
                      : 'border border-white/10 text-white/60 hover:bg-white/5'
                  }`}
                >
                  {modeLabels[mode]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            {/* Target player selection */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                {invoiceMode === 'entreprise' ? 'Entreprise cible' : 'Citoyen cible'}
              </p>
              <div className="mt-3 flex items-center justify-between rounded-full border border-white/10 bg-base-900 px-4 py-2">
                <span className="text-white/70">
                  {targetPlayerName || 'Aucun joueur selectionne'}
                </span>
                <button
                  onClick={handleScanNearby}
                  disabled={isScanning}
                  className="rounded-full bg-accent-600 px-3 py-1 text-xs text-base-950 disabled:opacity-50"
                >
                  {isScanning ? 'Scan...' : 'Scanner'}
                </button>
              </div>
              {nearbyPlayers.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-white/10 bg-base-900">
                  {nearbyPlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setTargetPlayerId(String(p.id));
                        setTargetPlayerName(p.name);
                        setTargetIdentifier(p.identifier);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-white/5 ${
                        targetIdentifier === p.identifier ? 'bg-accent-600/20' : ''
                      }`}
                    >
                      {p.name} (ID: {p.id})
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
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
                  OK
                </button>
              </div>
              {targetIdentifier && (
                <p className="mt-2 text-xs text-accent-500">
                  Cible: {targetPlayerName}
                </p>
              )}
            </div>

            {/* Product selection */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Details</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUseCustomPrice(false)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      !useCustomPrice
                        ? 'bg-accent-600 text-base-950'
                        : 'border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    Produit
                  </button>
                  <button
                    onClick={() => setUseCustomPrice(true)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      useCustomPrice
                        ? 'bg-accent-600 text-base-950'
                        : 'border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    Prix custom
                  </button>
                </div>

                {!useCustomPrice ? (
                  <select
                    value={selectedProduct?.id ?? ''}
                    onChange={(e) => {
                      const prod = products.find((p) => p.id === Number(e.target.value));
                      setSelectedProduct(prod ?? null);
                    }}
                    className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                  >
                    <option value="">Choisir un produit</option>
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.label} - {currency.format(prod.price)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                      placeholder="Motif / prestation"
                    />
                    <input
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                      placeholder="Montant HT ($)"
                    />
                  </>
                )}

                <div className="flex items-center gap-2 text-xs text-white/60">
                  <button
                    onClick={() => setIsTaxFree(false)}
                    className={`rounded-full px-3 py-1 ${
                      !isTaxFree
                        ? 'bg-accent-600 text-base-950'
                        : 'border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    Taxe auto ({Math.round(taxRate * 100)}%)
                  </button>
                  <button
                    onClick={() => setIsTaxFree(true)}
                    className={`rounded-full px-3 py-1 ${
                      isTaxFree
                        ? 'bg-accent-600 text-base-950'
                        : 'border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    Sans taxe
                  </button>
                </div>

                {isTaxFree && (
                  <input
                    value={taxFreeReason}
                    onChange={(e) => setTaxFreeReason(e.target.value)}
                    className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                    placeholder="Justification (obligatoire)"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="font-display text-lg">Previsualisation</h3>
          <p className="text-sm text-white/50">HT / TVA / TTC avant validation.</p>
          <div className="mt-6 space-y-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-white/50">Prestation</p>
              <p className="font-medium">
                {useCustomPrice
                  ? customLabel || '-'
                  : selectedProduct?.label || '-'}
              </p>
            </div>
            {[
              { label: 'Montant HT', value: currency.format(amountHT) },
              {
                label: `TVA (${Math.round(currentTaxRate * 100)}%)`,
                value: currency.format(taxAmount)
              },
              { label: 'Total TTC', value: currency.format(totalTTC), highlight: true }
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-white/60">{row.label}</span>
                <span className={row.highlight ? 'font-display text-lg text-accent-500' : 'font-medium'}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={handleSendInvoice}
            disabled={isSending || amountHT <= 0 || (!targetIdentifier && invoiceMode === 'citoyen') || (isTaxFree && !taxFreeReason)}
            className="mt-6 w-full rounded-full bg-accent-600 py-2 text-sm font-medium text-base-950 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? 'Envoi en cours...' : 'Envoyer la facture'}
          </button>
          {amountHT <= 0 && (
            <p className="mt-2 text-xs text-red-400 text-center">Selectionnez un produit ou saisissez un montant</p>
          )}
          {!targetIdentifier && invoiceMode === 'citoyen' && amountHT > 0 && (
            <p className="mt-2 text-xs text-red-400 text-center">Selectionnez un joueur cible</p>
          )}
        </div>
      </section>

      {/* Invoice list */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[
              { id: 'all' as const, label: 'Toutes' },
              { id: 'paid' as const, label: 'Payees' },
              { id: 'pending' as const, label: 'Impayees' },
              { id: 'tax_free' as const, label: 'Sans taxe' }
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
              placeholder="Recherche..."
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
        ) : filteredInvoices.length === 0 ? (
          <div className="mt-6 text-center text-white/50 py-12">
            <div className="flex justify-center mb-2">
              <Icon name="file-text" />
            </div>
            <p>Aucune facture trouvee</p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Prestation</th>
                  <th className="px-6 py-4">Montant</th>
                  <th className="px-6 py-4">Taxe</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.invoice_id} className="border-t border-white/5">
                    <td className="px-6 py-4 font-medium">{invoice.invoice_id}</td>
                    <td className="px-6 py-4 text-white/70">
                      {invoice.target_name || invoice.job_name}
                    </td>
                    <td className="px-6 py-4 text-white/70">{invoice.product_label}</td>
                    <td className="px-6 py-4">{currency.format(invoice.total_ttc)}</td>
                    <td className="px-6 py-4">
                      <span className="badge">{formatTax(invoice.tax_rate)}</span>
                    </td>
                    <td className="px-6 py-4 text-white/50">{formatDate(invoice.created_at)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          invoice.status === 'paid'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-orange-500/20 text-orange-400'
                        }`}
                      >
                        {invoice.status === 'paid' ? 'Payee' : 'En attente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between text-sm text-white/60">
          <span>Affichage {filteredInvoices.length} facture(s)</span>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
