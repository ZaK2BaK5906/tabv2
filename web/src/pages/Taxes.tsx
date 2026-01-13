import { useEffect, useState, useCallback } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';
import Icon from '../components/Icon';

type CompanyData = {
  job_name: string;
  job_label: string;
  society_balance: number;
  total_invoiced: number;
  total_taxes: number;
  employee_count: number;
};

type TaxInvoice = {
  invoice_id: string;
  job_name: string;
  job_label: string;
  tax_amount: number;
  tax_rate: number;
  tax_free_reason?: string;
  status: string;
  created_at: string;
};

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const Taxes = () => {
  const { player } = usePlayerStore();
  const [rate, setRate] = useState(0.15);
  const [inputRate, setInputRate] = useState('15');
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [invoices, setInvoices] = useState<TaxInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<CompanyData | null>(null);
  const [totalTaxesGenerated, setTotalTaxesGenerated] = useState(0);

  const syncRate = (value: number) => {
    setRate(value);
    setInputRate(String(Math.round(value * 100)));
  };

  const loadSettings = useCallback(() => {
    fetchNui<{ ok: boolean; taxes: { defaultRate: number } }>('mdt:getTaxSettings')
      .then((response) => {
        if (response.ok) {
          syncRate(response.taxes.defaultRate ?? 0.15);
        }
      })
      .catch(() => undefined);
  }, []);

  const loadCompanies = useCallback(() => {
    fetchNui<{ ok: boolean; companies: CompanyData[]; totalTaxes: number }>('mdt:getAllCompanies')
      .then((response) => {
        if (response.ok) {
          setCompanies(response.companies ?? []);
          setTotalTaxesGenerated(response.totalTaxes ?? 0);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  const loadTaxInvoices = useCallback(() => {
    fetchNui<{ ok: boolean; invoices: TaxInvoice[] }>('mdt:getTaxInvoices')
      .then((response) => {
        if (response.ok) {
          setInvoices(response.invoices ?? []);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadSettings();
    loadCompanies();
    loadTaxInvoices();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated') {
        if (event.data?.entity === 'taxes') {
          loadSettings();
          loadCompanies();
          loadTaxInvoices();
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadSettings, loadCompanies, loadTaxInvoices]);

  const applyRate = async () => {
    const value = Math.max(0, Number(inputRate) / 100);
    try {
      await fetchNui('mdt:updateTaxRate', { rate: value });
      syncRate(value);
    } catch {
      // ignore
    }
  };

  const handleViewReport = (company: CompanyData) => {
    setSelectedCompany(company);
  };

  // Filter companies
  const filteredCompanies = companies.filter((c) => {
    if (search) {
      return (
        c.job_label.toLowerCase().includes(search.toLowerCase()) ||
        c.job_name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return true;
  });

  // Filter invoices for selected company
  const companyInvoices = selectedCompany
    ? invoices.filter((inv) => inv.job_name === selectedCompany.job_name)
    : invoices;

  const isDOJ = player?.job?.name === 'doj';

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-2xl">Controle fiscal DOJ</h2>
        <p className="text-white/50">
          Gestion globale des taxes, surveillance des entreprises et historique fiscal.
        </p>
      </header>

      <section className="grid grid-cols-4 gap-6">
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500/20 text-accent-400">
              <Icon name="scale" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Taux global</p>
              <p className="mt-1 font-display text-2xl">{Math.round(rate * 100)}%</p>
            </div>
          </div>
          {isDOJ && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <input
                className="w-20 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-center text-white/70"
                value={inputRate}
                onChange={(e) => setInputRate(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="15"
              />
              <button
                onClick={applyRate}
                className="rounded-full bg-accent-600 px-4 py-1 text-sm text-base-950"
              >
                Appliquer
              </button>
            </div>
          )}
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/20 text-green-400">
              <Icon name="money" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Taxes generees</p>
              <p className="mt-1 font-display text-2xl">{currency.format(totalTaxesGenerated)}</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400">
              <Icon name="box" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Entreprises</p>
              <p className="mt-1 font-display text-2xl">{companies.length}</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400">
              <Icon name="file-text" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Factures taxees</p>
              <p className="mt-1 font-display text-2xl">{invoices.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* All Companies */}
      <section className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg">Toutes les entreprises</h3>
            <p className="text-sm text-white/50">Soldes et activite fiscale de chaque societe.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
              placeholder="Rechercher une entreprise..."
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
        ) : filteredCompanies.length === 0 ? (
          <div className="mt-6 text-center text-white/50 py-12">
            <Icon name="box" />
            <p className="mt-2">Aucune entreprise trouvee</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-4">
            {filteredCompanies.map((company) => (
              <div
                key={company.job_name}
                className={`rounded-2xl border p-4 transition cursor-pointer ${
                  selectedCompany?.job_name === company.job_name
                    ? 'border-accent-500 bg-accent-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
                onClick={() => handleViewReport(company)}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{company.job_label}</p>
                  <span className="text-xs text-white/40">{company.job_name}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-white/40">Solde</p>
                    <p className="text-accent-500 font-medium">
                      {currency.format(company.society_balance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Taxes payees</p>
                    <p className="text-green-400">{currency.format(company.total_taxes)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Facture</p>
                    <p>{currency.format(company.total_invoiced)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Employes</p>
                    <p>{company.employee_count}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewReport(company);
                  }}
                  className="mt-3 text-sm text-accent-500 hover:text-accent-400"
                >
                  Voir rapport
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tax History */}
      <section className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg">
              {selectedCompany
                ? `Historique fiscal - ${selectedCompany.job_label}`
                : 'Historique TVA et facturation'}
            </h3>
            <p className="text-sm text-white/50">
              Details par entreprise, justification et statut de paiement.
            </p>
          </div>
          {selectedCompany && (
            <button
              onClick={() => setSelectedCompany(null)}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              Voir tout
            </button>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-6 py-4">Entreprise</th>
                <th className="px-6 py-4">Facture</th>
                <th className="px-6 py-4">Taxe</th>
                <th className="px-6 py-4">Taux</th>
                <th className="px-6 py-4">Justification</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Statut</th>
              </tr>
            </thead>
            <tbody>
              {companyInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-white/50">
                    Aucune facture trouvee
                  </td>
                </tr>
              ) : (
                companyInvoices.slice(0, 20).map((inv) => (
                  <tr key={inv.invoice_id} className="border-t border-white/5">
                    <td className="px-6 py-4 font-medium">{inv.job_label}</td>
                    <td className="px-6 py-4 text-white/70">{inv.invoice_id}</td>
                    <td className="px-6 py-4 text-accent-500">
                      {currency.format(inv.tax_amount)}
                    </td>
                    <td className="px-6 py-4">
                      {inv.tax_rate > 0 ? `${Math.round(inv.tax_rate * 100)}%` : 'Exonere'}
                    </td>
                    <td className="px-6 py-4 text-white/60">
                      {inv.tax_free_reason || '-'}
                    </td>
                    <td className="px-6 py-4 text-white/50">{formatDate(inv.created_at)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          inv.status === 'paid'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-orange-500/20 text-orange-400'
                        }`}
                      >
                        {inv.status === 'paid' ? 'Payee' : 'En attente'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Taxes;
