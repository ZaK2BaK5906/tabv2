import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';
import Icon from '../components/Icon';

type Invoice = {
  id: number;
  invoice_id: string;
  job_name: string;
  issuer_name: string;
  product_label: string;
  amount_ht: number;
  tax_rate: number;
  tax_amount: number;
  total_ttc: number;
  status: string;
  created_at: string;
};

const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('$US', '$');
};

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

const MyInvoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const { player } = usePlayerStore();

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const response = await fetchNui<{ ok: boolean; invoices: Invoice[] }>('mdt:getMyInvoices');
      if (response.ok) {
        setInvoices(response.invoices ?? []);
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadInvoices();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'invoices') {
        loadInvoices();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handlePay = async (invoice: Invoice, payFromCompany: boolean = false) => {
    setPayingId(invoice.invoice_id);
    try {
      const response = await fetchNui<{ ok: boolean; reason?: string }>('mdt:payInvoice', {
        invoiceId: invoice.invoice_id,
        amount: invoice.total_ttc,
        payFromCompany
      });

      if (response.ok) {
        loadInvoices();
      } else {
        console.error('Payment failed:', response.reason);
      }
    } catch {
      // ignore
    }
    setPayingId(null);
  };

  const pendingInvoices = invoices.filter((inv) => inv.status === 'pending');
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
  const totalDue = pendingInvoices.reduce((sum, inv) => sum + inv.total_ttc, 0);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Chargement de vos factures...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Mes Factures</h2>
          <p className="text-white/50">
            {player?.fullname ?? 'Citoyen'} - Consultez et payez vos factures
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-full border border-white/10 bg-surface-800 px-4 py-2 text-sm">
            <span className="text-white/50">Solde banque: </span>
            <span className="font-medium text-accent-500">
              {formatMoney(player?.money?.bank ?? 0)}
            </span>
          </div>
          <button
            onClick={loadInvoices}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
          >
            Actualiser
          </button>
        </div>
      </header>

      {/* Summary cards */}
      <section className="grid grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
              <Icon name="file-text" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">À payer</p>
              <p className="font-display text-2xl text-red-400">{formatMoney(totalDue)}</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400">
              <Icon name="clock" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">En attente</p>
              <p className="font-display text-2xl">{pendingInvoices.length}</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/20 text-green-400">
              <Icon name="check" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Payées</p>
              <p className="font-display text-2xl">{paidInvoices.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pending invoices */}
      {pendingInvoices.length > 0 && (
        <section className="glass-panel rounded-2xl p-6">
          <h3 className="font-display text-lg mb-4">Factures à payer</h3>
          <div className="space-y-3">
            {pendingInvoices.map((invoice) => (
              <div
                key={invoice.invoice_id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                    <Icon name="file-text" />
                  </div>
                  <div>
                    <p className="font-medium">{invoice.product_label}</p>
                    <p className="text-sm text-white/50">
                      {invoice.issuer_name} ({invoice.job_name}) - {formatDate(invoice.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-display text-xl text-red-400">{formatMoney(invoice.total_ttc)}</p>
                    <p className="text-xs text-white/40">
                      HT: {formatMoney(invoice.amount_ht)} + TVA: {formatMoney(invoice.tax_amount)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePay(invoice, false)}
                      disabled={payingId === invoice.invoice_id}
                      className="rounded-full bg-accent-600 px-4 py-2 text-sm font-medium text-base-950 transition hover:bg-accent-500 disabled:opacity-50"
                    >
                      {payingId === invoice.invoice_id ? 'Paiement...' : 'Payer'}
                    </button>
                    {player?.isBoss && (
                      <button
                        onClick={() => handlePay(invoice, true)}
                        disabled={payingId === invoice.invoice_id}
                        className="rounded-full border border-accent-600 px-4 py-2 text-sm font-medium text-accent-500 transition hover:bg-accent-600/10 disabled:opacity-50"
                      >
                        Payer (Entreprise)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Paid invoices */}
      {paidInvoices.length > 0 && (
        <section className="glass-panel rounded-2xl p-6">
          <h3 className="font-display text-lg mb-4">Historique des paiements</h3>
          <div className="overflow-hidden rounded-2xl border border-white/5">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
                <tr>
                  <th className="px-6 py-4">Facture</th>
                  <th className="px-6 py-4">Émetteur</th>
                  <th className="px-6 py-4">Montant</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {paidInvoices.slice(0, 10).map((invoice) => (
                  <tr key={invoice.invoice_id} className="border-t border-white/5">
                    <td className="px-6 py-4 font-medium">{invoice.product_label}</td>
                    <td className="px-6 py-4 text-white/70">{invoice.issuer_name}</td>
                    <td className="px-6 py-4">{formatMoney(invoice.total_ttc)}</td>
                    <td className="px-6 py-4 text-white/50">{formatDate(invoice.created_at)}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-400">
                        Payée
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {invoices.length === 0 && (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/20 text-green-400">
              <Icon name="check" />
            </div>
          </div>
          <h3 className="font-display text-xl">Aucune facture</h3>
          <p className="text-white/50 mt-2">Vous n'avez aucune facture en attente.</p>
        </div>
      )}
    </div>
  );
};

export default MyInvoices;
