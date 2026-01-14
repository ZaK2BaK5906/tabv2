import { useEffect, useState } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';

type EmployeeRow = {
  identifier: string;
  firstname?: string;
  lastname?: string;
  job_grade: number;
  invoices_count?: number;
  sales_total?: number;
  commission_rate?: number;
  commission_due?: number;
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

const formatPercent = (value?: number) =>
  value !== undefined ? `${Math.round(value * 100)}%` : '—';

const Employees = () => {
  const { player } = usePlayerStore();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'boss' | 'senior' | 'junior'>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showHireModal, setShowHireModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);

  // Hire modal state
  const [hireTargetId, setHireTargetId] = useState('');
  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // Promote modal state
  const [newGrade, setNewGrade] = useState('');

  // Action states
  const [isActioning, setIsActioning] = useState(false);

  const isBoss = player?.isBoss ?? false;

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      const response = await fetchNui<{ ok: boolean; employees: EmployeeRow[] }>('mdt:getEmployeeStats');
      if (response.ok) {
        setRows(response.employees ?? []);
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadEmployees();
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'employees') {
        loadEmployees();
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
      }
    } catch {
      // ignore
    }
    setIsScanning(false);
  };

  const handleHire = async (targetId: number) => {
    setIsActioning(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:hireEmployeeById', { targetId });
      if (response.ok) {
        setShowHireModal(false);
        setHireTargetId('');
        setNearbyPlayers([]);
        loadEmployees();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const handleFire = async (identifier: string) => {
    if (!confirm('Etes-vous sur de vouloir licencier cet employe ?')) return;
    setIsActioning(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:fireEmployeeByIdentifier', { identifier });
      if (response.ok) {
        loadEmployees();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const handlePromote = async () => {
    if (!selectedEmployee || !newGrade) return;
    setIsActioning(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:promoteEmployeeByIdentifier', {
        identifier: selectedEmployee.identifier,
        newGrade: parseInt(newGrade, 10)
      });
      if (response.ok) {
        setShowPromoteModal(false);
        setSelectedEmployee(null);
        setNewGrade('');
        loadEmployees();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const handlePay = async () => {
    if (!selectedEmployee || !selectedEmployee.commission_due) return;
    setIsActioning(true);
    try {
      const employeeName = [selectedEmployee.firstname, selectedEmployee.lastname].filter(Boolean).join(' ') || selectedEmployee.identifier;
      const response = await fetchNui<{ ok: boolean }>('mdt:payEmployeeCommission', {
        identifier: selectedEmployee.identifier,
        employeeName,
        amount: selectedEmployee.commission_due
      });
      if (response.ok) {
        setShowPayModal(false);
        setSelectedEmployee(null);
        loadEmployees();
      }
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  const handleReset = async (identifier: string) => {
    setIsActioning(true);
    try {
      await fetchNui('mdt:resetEmployeeStats', { identifier });
      loadEmployees();
    } catch {
      // ignore
    }
    setIsActioning(false);
  };

  // Filter employees
  const filteredRows = rows.filter((employee) => {
    if (filter === 'boss' && employee.job_grade < 3) return false;
    if (filter === 'senior' && (employee.job_grade < 1 || employee.job_grade > 2)) return false;
    if (filter === 'junior' && employee.job_grade !== 0) return false;
    if (search) {
      const name = [employee.firstname, employee.lastname].filter(Boolean).join(' ').toLowerCase();
      return name.includes(search.toLowerCase()) || employee.identifier.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const totalCommissionsDue = rows.reduce((sum, row) => sum + (row.commission_due ?? 0), 0);
  const totalSales = rows.reduce((sum, row) => sum + (row.sales_total ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        Chargement des employes...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Gestion des employes</h2>
          <p className="text-white/50">
            {isBoss ? 'Recrutement, promotions, commissions et gestion.' : 'Consultez les employes de votre entreprise.'}
          </p>
        </div>
        {isBoss && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowHireModal(true)}
              className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 transition hover:bg-white/5"
            >
              Recruter
            </button>
          </div>
        )}
      </header>

      <section className="grid grid-cols-3 gap-6">
        {[
          { label: 'Effectif', value: rows.length },
          { label: 'Commissions dues', value: currency.format(totalCommissionsDue) },
          { label: 'Ventes periode', value: currency.format(totalSales) }
        ].map((metric) => (
          <div key={metric.label} className="glass-panel rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">{metric.label}</p>
            <p className="mt-3 font-display text-3xl">{metric.value}</p>
          </div>
        ))}
      </section>

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['all', 'boss', 'senior', 'junior'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                  filter === f
                    ? 'border-accent-500 bg-accent-500/20 text-accent-400'
                    : 'border-white/10 text-white/60 hover:bg-white/5'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'boss' ? 'Patrons' : f === 'senior' ? 'Seniors' : 'Juniors'}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
            placeholder="Recherche employe..."
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/50">
              <tr>
                <th className="px-6 py-4">Employe</th>
                <th className="px-6 py-4">Grade</th>
                <th className="px-6 py-4">Factures</th>
                <th className="px-6 py-4">Ventes</th>
                <th className="px-6 py-4">Commission</th>
                {isBoss && <th className="px-6 py-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((employee) => (
                <tr key={employee.identifier} className="border-t border-white/5">
                  <td className="px-6 py-4 font-medium">
                    {[employee.firstname, employee.lastname].filter(Boolean).join(' ') || employee.identifier}
                  </td>
                  <td className="px-6 py-4 text-white/70">{employee.job_grade ?? 0}</td>
                  <td className="px-6 py-4">{employee.invoices_count ?? 0}</td>
                  <td className="px-6 py-4">{currency.format(employee.sales_total ?? 0)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-accent-500">{currency.format(employee.commission_due ?? 0)}</span>
                      <span className="text-xs text-white/40">{formatPercent(employee.commission_rate)}</span>
                    </div>
                  </td>
                  {isBoss && (
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {(employee.commission_due ?? 0) > 0 && (
                          <button
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setShowPayModal(true);
                            }}
                            disabled={isActioning}
                            className="rounded-full bg-accent-600 px-3 py-1 text-xs font-medium text-base-950 disabled:opacity-50"
                          >
                            Payer
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setNewGrade(String((employee.job_grade ?? 0) + 1));
                            setShowPromoteModal(true);
                          }}
                          disabled={isActioning}
                          className="rounded-full border border-white/10 px-3 py-1 text-xs disabled:opacity-50"
                        >
                          Promouvoir
                        </button>
                        <button
                          onClick={() => handleFire(employee.identifier)}
                          disabled={isActioning}
                          className="rounded-full border border-white/10 px-3 py-1 text-xs text-red-400 disabled:opacity-50"
                        >
                          Licencier
                        </button>
                        <button
                          onClick={() => handleReset(employee.identifier)}
                          disabled={isActioning}
                          className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 disabled:opacity-50"
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={isBoss ? 6 : 5} className="px-6 py-8 text-center text-white/50">
                    Aucun employe trouve
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hire Modal */}
      {showHireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display text-lg">Recruter un employe</h3>
            <p className="text-sm text-white/50">Selectionnez une personne a proximite ou entrez son ID.</p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-full border border-white/10 bg-base-900 px-4 py-2">
                <span className="text-white/70">
                  {nearbyPlayers.length > 0 ? `${nearbyPlayers.length} personne(s) a proximite` : 'Rechercher'}
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
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {nearbyPlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleHire(p.id)}
                      disabled={isActioning}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10 disabled:opacity-50"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  value={hireTargetId}
                  onChange={(e) => setHireTargetId(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                  placeholder="ID de la personne"
                />
                <button
                  onClick={() => hireTargetId && handleHire(parseInt(hireTargetId, 10))}
                  disabled={!hireTargetId || isActioning}
                  className="rounded-full bg-accent-600 px-4 py-2 text-xs text-base-950 disabled:opacity-50"
                >
                  Recruter
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowHireModal(false);
                  setNearbyPlayers([]);
                  setHireTargetId('');
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote Modal */}
      {showPromoteModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display text-lg">Promouvoir un employe</h3>
            <p className="text-sm text-white/50">
              {[selectedEmployee.firstname, selectedEmployee.lastname].filter(Boolean).join(' ') || selectedEmployee.identifier}
            </p>

            <div className="mt-4">
              <label className="text-xs text-white/50">Nouveau grade</label>
              <input
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value.replace(/\D/g, ''))}
                className="mt-1 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
                placeholder="Grade (0-10)"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPromoteModal(false);
                  setSelectedEmployee(null);
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={handlePromote}
                disabled={!newGrade || isActioning}
                className="rounded-full bg-accent-600 px-4 py-2 text-sm text-base-950 disabled:opacity-50"
              >
                Promouvoir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display text-lg">Payer la commission</h3>
            <p className="text-sm text-white/50">
              {[selectedEmployee.firstname, selectedEmployee.lastname].filter(Boolean).join(' ') || selectedEmployee.identifier}
            </p>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/50">Montant a payer</p>
              <p className="mt-1 font-display text-2xl text-accent-500">
                {currency.format(selectedEmployee.commission_due ?? 0)}
              </p>
              <p className="mt-1 text-xs text-white/40">
                Sera preleve sur la caisse de la societe
              </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPayModal(false);
                  setSelectedEmployee(null);
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={handlePay}
                disabled={isActioning}
                className="rounded-full bg-accent-600 px-4 py-2 text-sm text-base-950 disabled:opacity-50"
              >
                {isActioning ? 'Paiement...' : 'Confirmer le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
