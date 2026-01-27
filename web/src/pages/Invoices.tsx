import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';

type InvoiceRow = {
  invoice_id: string;
  job_name: string;
  issuer_name: string;
  target_name?: string;
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
  status?: string;
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
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

type InvoiceMode = 'vente' | 'achat' | 'entreprise';

const Invoices = () => {
  const { player } = usePlayerStore();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'tax_free'>('all');
  const [search, setSearch] = useState('');

  // Invoice creation state
  const [mode, setMode] = useState<InvoiceMode>('vente');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [taxFree, setTaxFree] = useState(false);
  const [taxFreeReason, setTaxFreeReason] = useState('');
  const [targetPlayer, setTargetPlayer] = useState<NearbyPlayer | null>(null);
  const [targetIdInput, setTargetIdInput] = useState('');
  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Tax settings
  const [taxRate, setTaxRate] = useState(0.15);

  const loadInvoices = () => {
    fetchNui<{ ok: boolean; invoices: InvoiceRow[] }>('mdt:getInvoices')
      .then((response) => {
        if (response.ok) {
          setRows(response.invoices ?? []);
        }
      })
      .catch(() => undefined);
  };

  const loadProducts = () => {
    fetchNui<{ ok: boolean; products: Product[] }>('mdt:getProducts')
      .then((response) => {
        if (response.ok) {
          setProducts((response.products ?? []).filter(p => p.status !== 'draft'));
        }
      })
      .catch(() => undefined);
  };

  const loadTaxSettings = () => {
    fetchNui<{ ok: boolean; taxes: { defaultRate: number } }>('mdt:getTaxSettings')
      .then((response) => {
        if (response.ok && response.taxes) {
          setTaxRate(response.taxes.defaultRate ?? 0.15);
        }
      })
      .catch(() => undefined);
  };

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
  }, []);

  const handleScanNearby = async () => {
    setIsScanning(true);
    try {
      const response = await fetchNui<{ ok: boolean; players: NearbyPlayer[] }>('mdt:getNearbyPlayers');
      if (response.ok) {
        setNearbyPlayers(response.players ?? []);
        if (response.players && response.players.length > 0) {
          setTargetPlayer(response.players[0]);
        }
      }
    } catch {
      // ignore
    }
    setIsScanning(false);
  };

  const handleValidateId = async () => {
    const id = parseInt(targetIdInput, 10);
    if (isNaN(id) || id <= 0) return;

    try {
      const response = await fetchNui<{ ok: boolean; player?: NearbyPlayer }>('mdt:getPlayerById', { id });
      if (response.ok && response.player) {
        setTargetPlayer(response.player);
        setNearbyPlayers([response.player]);
      }
    } catch {
      // ignore
    }
  };

  // Calculate preview values
  const amountHT = useCustomPrice
    ? (parseInt(customPrice, 10) || 0)
    : (selectedProduct?.price ?? 0);

  const effectiveTaxRate = taxFree ? 0 : taxRate;
  const taxAmount = Math.round(amountHT * effectiveTaxRate);
  const totalTTC = amountHT + taxAmount;

  const productLabel = useCustomPrice
    ? (customLabel || 'Prestation')
    : (selectedProduct?.label ?? 'Aucun produit');

  const canSend = (selectedProduct || (useCustomPrice && customPrice)) && targetPlayer;

  const handleSendInvoice = async () => {
    if (!canSend || isSending) return;

    setIsSending(true);
    try {
      const invoiceId = `INV-${Date.now()}`;
      const response = await fetchNui<{ ok: boolean; invoiceId?: string }>('mdt:createInvoice', {
        invoiceId,
        mode,
        product: productLabel,
        amount: amountHT,
        taxRate: effectiveTaxRate,
        taxAmount,
        total: totalTTC,
        issuer: player?.fullname ?? 'MDT',
        targetIdentifier: targetPlayer?.identifier,
        targetName: targetPlayer?.name,
        taxFreeReason: taxFree ? taxFreeReason : null,
        giveItem: true
      });

      if (response.ok) {
        // Reset form
        setSelectedProduct(null);
        setUseCustomPrice(false);
        setCustomLabel('');
        setCustomPrice('');
        setTaxFree(false);
        setTaxFreeReason('');
        setTargetPlayer(null);
        setTargetIdInput('');
        setNearbyPlayers([]);
        loadInvoices();
      }
    } catch {
      // ignore
    }
    setIsSending(false);
  };

  // Filter invoices
  const filteredRows = rows.filter((invoice) => {
    if (filter === 'paid' && invoice.status !== 'paid') return false;
    if (filter === 'pending' && invoice.status !== 'pending') return false;
    if (filter === 'tax_free' && invoice.tax_rate > 0) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        invoice.invoice_id.toLowerCase().includes(searchLower) ||
        invoice.target_name?.toLowerCase().includes(searchLower) ||
        invoice.product_label.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const isDoj = player?.job?.name === 'doj';

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Facturation clients</h2>
          <p className="text-white/50">
            Facturation HT / TVA / TTC. {isDoj && 'Le DOJ peut facturer sans TVA.'}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-6">
        <div className="glass-panel col-span-2 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg">Nouvelle facture</h3>
              <p className="text-sm text-white/50">
                Client citoyen ou entreprise (paiement patron).
              </p>
            </div>
            <div className="flex gap-2">
              {([
                { id: 'vente', label: 'Facture de vente' },
                { id: 'achat', label: "Facture d'achat" },
                { id: 'entreprise', label: 'Facture entreprise' }
              ] as const).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-full border px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                    mode === m.id
                      ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                      : 'border-white/10 text-white/60 hover:bg-white/5'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            {/* Client selection */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Client</p>

              {targetPlayer ? (
                <div className="mt-3 flex items-center justify-between rounded-full border border-accent-500/50 bg-accent-500/10 px-4 py-2">
                  <span className="text-accent-400">{targetPlayer.name}</span>
                  <button
                    onClick={() => {
                      setTargetPlayer(null);
                      setNearbyPlayers([]);
                    }}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-3 flex items-center justify-between rounded-full border border-white/10 bg-base-900 px-4 py-2">
                    <span className="text-white/70">
                      {nearbyPlayers.length > 0
                        ? `${nearbyPlayers.length} personne(s) a proximite`
                        : 'Rechercher un client'}
                    </span>
                    <button
                      onClick={handleScanNearby}
                      disabled={isScanning}
                      className="rounded-full bg-accent-600 px-3 py-1 text-xs text-base-950"
                    >
                      {isScanning ? 'Recherche...' : 'Proximite'}
                    </button>
                  </div>

                  {nearbyPlayers.length > 0 && (
                    <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
                      {nearbyPlayers.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setTargetPlayer(p)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={targetIdInput}
                      onChange={(e) => setTargetIdInput(e.target.value)}
                      className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                      placeholder="N° identifiant client"
                    />
                    <button
                      onClick={handleValidateId}
                      className="rounded-full border border-white/10 px-4 py-2 text-xs hover:bg-white/5"
                    >
                      Valider
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Product/Price selection */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Details</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUseCustomPrice(false)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      !useCustomPrice
                        ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    Produit
                  </button>
                  <button
                    onClick={() => setUseCustomPrice(true)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      useCustomPrice
                        ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    Prix custom
                  </button>
                </div>

                {!useCustomPrice ? (
                  <select
                    value={selectedProduct?.id ?? ''}
                    onChange={(e) => {
                      const product = products.find((p) => p.id === parseInt(e.target.value, 10));
                      setSelectedProduct(product ?? null);
                    }}
                    className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                  >
                    <option value="">Choisir un produit</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.label} - {currency.format(product.price)}
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
                      onChange={(e) => setCustomPrice(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                      placeholder="Montant HT"
                    />
                  </>
                )}

                <div className="flex items-center gap-2 text-xs text-white/60">
                  <button
                    onClick={() => setTaxFree(false)}
                    className={`rounded-full border px-3 py-1 ${
                      !taxFree
                        ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                        : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    Taxe auto ({Math.round(taxRate * 100)}%)
                  </button>
                  {isDoj && (
                    <button
                      onClick={() => setTaxFree(true)}
                      className={`rounded-full border px-3 py-1 ${
                        taxFree
                          ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                          : 'border-white/10 hover:bg-white/5'
                      }`}
                    >
                      Sans taxe
                    </button>
                  )}
                </div>

                {taxFree && (
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

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-white/50">Produit</p>
            <p className="font-medium">{productLabel}</p>
          </div>

          {targetPlayer && (
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-white/50">Client</p>
              <p className="font-medium">{targetPlayer.name}</p>
            </div>
          )}

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Montant HT</span>
              <span className="font-medium">{currency.format(amountHT)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">
                TVA ({taxFree ? 'Exoneree' : `${Math.round(effectiveTaxRate * 100)}%`})
              </span>
              <span className="font-medium">{currency.format(taxAmount)}</span>
            </div>
            <div className="h-px bg-white/10"></div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Total TTC</span>
              <span className="font-display text-xl text-accent-500">
                {currency.format(totalTTC)}
              </span>
            </div>
          </div>

          <button
            onClick={handleSendInvoice}
            disabled={!canSend || isSending}
            className={`mt-6 w-full rounded-full py-2 text-sm font-medium transition ${
              canSend && !isSending
                ? 'bg-accent-600 text-base-950 hover:bg-accent-500'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {isSending ? 'Envoi en cours...' : 'Envoyer la facture'}
          </button>
        </div>
      </section>

      {/* Invoice list */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {([
              { id: 'all', label: 'Toutes' },
              { id: 'paid', label: 'Payees' },
              { id: 'pending', label: 'Impayees' },
              { id: 'tax_free', label: 'Sans taxe' }
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
              placeholder="Recherche..."
            />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Produit</th>
                <th className="px-6 py-4">Montant</th>
                <th className="px-6 py-4">Taxe</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((invoice) => (
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
                  <td className="px-6 py-4 text-white/50">{formatDate(invoice.created_at)}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-white/50">
                    Aucune facture trouvee
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

export default Invoices;
