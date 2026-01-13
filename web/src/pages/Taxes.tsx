import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';

const Taxes = () => {
  const [rate, setRate] = useState(0.15);
  const [inputRate, setInputRate] = useState('15');

  const syncRate = (value: number) => {
    setRate(value);
    setInputRate(String(Math.round(value * 100)));
  };

  const loadSettings = () => {
    fetchNui<{ ok: boolean; taxes: { defaultRate: number } }>('mdt:getTaxSettings')
      .then((response) => {
        if (response.ok) {
          syncRate(response.taxes.defaultRate ?? 0.15);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    loadSettings();
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'taxes') {
        loadSettings();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const applyRate = () => {
    const value = Math.max(0, Number(inputRate) / 100);
    fetchNui('mdt:updateTaxRate', { rate: value }).catch(() => undefined);
  };

  return (
    <div className="space-y-8">
    <header>
      <h2 className="font-display text-2xl">Contrôle fiscal DOJ</h2>
      <p className="text-white/50">Gestion globale des taxes, audits et sanctions RP.</p>
    </header>

    <section className="grid grid-cols-3 gap-6">
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Taux global</p>
        <div className="mt-3 flex items-end justify-between">
          <p className="font-display text-3xl">{Math.round(rate * 100)}%</p>
          <button className="rounded-full border border-white/10 px-4 py-1 text-sm">Modifier</button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-white/60">
          <input
            className="w-24 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-center"
            value={inputRate}
            onChange={(event) => setInputRate(event.target.value)}
            placeholder="15"
          />
          <button
            onClick={applyRate}
            className="rounded-full bg-accent-600 px-4 py-1 text-sm text-base-950"
          >
            Appliquer
          </button>
        </div>
        <div className="mt-4 text-sm text-white/60">
          Appliqué automatiquement sur toutes les factures taxées.
        </div>
      </div>
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Taxes générées</p>
        <p className="mt-3 font-display text-3xl">$128,430</p>
        <div className="mt-2 text-sm text-white/60">Période en cours</div>
      </div>
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Alertes actives</p>
        <p className="mt-3 font-display text-3xl">6</p>
        <div className="mt-2 text-sm text-white/60">Entreprises surveillées</div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-6">
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="font-display text-lg">Règles économiques</h3>
        <div className="mt-5 space-y-4 text-sm">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-medium">Plafond facturation sans taxe</p>
              <p className="text-white/50">$10,000</p>
            </div>
            <button className="rounded-full border border-white/10 px-4 py-1">Ajuster</button>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="font-medium">Seuil d'alerte</p>
              <p className="text-white/50">5 factures / 7 jours</p>
            </div>
            <button className="rounded-full border border-white/10 px-4 py-1">Ajuster</button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <h3 className="font-display text-lg">Actions RP disponibles</h3>
        <div className="mt-5 space-y-3">
          {['Amende', 'Gel entreprise', 'Audit forcé', 'Forcer paiement'].map((action) => (
            <div
              key={action}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <p>{action}</p>
              <button className="rounded-full bg-accent-600 px-4 py-1 text-sm text-base-950">
                Appliquer
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="glass-panel rounded-2xl p-6">
      <h3 className="font-display text-lg">Entreprises sous audit</h3>
      <div className="mt-4 flex items-center gap-2">
        <input
          className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
          placeholder="Rechercher une entreprise..."
        />
        <button className="rounded-full bg-accent-600 px-4 py-2 text-xs font-medium text-base-950">
          Rechercher
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        {['Benny\'s Customs', 'Maze Bank', 'Dynasty 8'].map((company) => (
          <div key={company} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="font-medium">{company}</p>
            <p className="text-sm text-white/50">Taxes dues élevées</p>
            <button className="mt-3 text-sm text-accent-500">Voir rapport</button>
          </div>
        ))}
      </div>
    </section>

    <section className="glass-panel rounded-2xl p-6">
      <h3 className="font-display text-lg">Historique TVA & facturation</h3>
      <p className="text-sm text-white/50">
        Détails par entreprise, justification et statut de paiement.
      </p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
            <tr>
              <th className="px-6 py-4">Entreprise</th>
              <th className="px-6 py-4">Facture</th>
              <th className="px-6 py-4">Taxe</th>
              <th className="px-6 py-4">Taux</th>
              <th className="px-6 py-4">Justification</th>
              <th className="px-6 py-4">Statut</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                company: "Benny's Customs",
                invoice: 'INV-2043',
                tax: '$0',
                rate: 'Exonération',
                justification: 'Réparation urgence',
                status: 'Validée'
              },
              {
                company: 'Maze Bank',
                invoice: 'INV-2041',
                tax: '$1,820',
                rate: '15%',
                justification: 'N/A',
                status: 'Payée'
              }
            ].map((row) => (
              <tr key={row.invoice} className="border-t border-white/5">
                <td className="px-6 py-4 font-medium">{row.company}</td>
                <td className="px-6 py-4 text-white/70">{row.invoice}</td>
                <td className="px-6 py-4">{row.tax}</td>
                <td className="px-6 py-4">{row.rate}</td>
                <td className="px-6 py-4 text-white/60">{row.justification}</td>
                <td className="px-6 py-4">
                  <span className="badge">{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </div>
  );
};

export default Taxes;
