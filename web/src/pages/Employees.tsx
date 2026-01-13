import { useEffect, useState, useCallback } from 'react';
import { fetchNui } from '../features/nui';
import { usePlayerStore } from '../store/playerStore';
import Icon from '../components/Icon';

type EmployeeRow = {
  identifier: string;
  firstname?: string;
  lastname?: string;
  job_grade: number;
  grade_label?: string;
  invoices_count?: number;
  sales_total?: number;
  commission_rate?: number;
  commission_due?: number;
  serverId?: number;
};

type NearbyPlayer = {
  id: number;
  name: string;
  identifier: string;
};

type JobGrade = {
  grade: number;
  label: string;
};

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

const formatPercent = (value?: number) =>
  value !== undefined ? `${Math.round(value * 100)}%` : '-';

const Employees = () => {
  const { player } = usePlayerStore();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);

  // Modal states
  const [showRecruitModal, setShowRecruitModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);
  const [nearbyPlayers, setNearbyPlayers] = useState<NearbyPlayer[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [recruitPlayerId, setRecruitPlayerId] = useState('');
  const [newGrade, setNewGrade] = useState(0);
  const [jobGrades, setJobGrades] = useState<JobGrade[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadEmployees = useCallback(() => {
    fetchNui<{ ok: boolean; employees: EmployeeRow[] }>('mdt:getEmployeeStats')
      .then((response) => {
        if (response.ok) {
          setRows(response.employees ?? []);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  const loadJobGrades = useCallback(() => {
    fetchNui<{ ok: boolean; grades: JobGrade[] }>('mdt:getJobGrades')
      .then((response) => {
        if (response.ok) {
          setJobGrades(response.grades ?? []);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadEmployees();
    loadJobGrades();

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:dataUpdated' && event.data?.entity === 'employees') {
        loadEmployees();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadEmployees, loadJobGrades]);

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

  const handleRecruit = async (playerId: number) => {
    setIsProcessing(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:hireEmployee', {
        targetId: playerId
      });
      if (response.ok) {
        setShowRecruitModal(false);
        setRecruitPlayerId('');
        setNearbyPlayers([]);
        loadEmployees();
      }
    } catch {
      // ignore
    }
    setIsProcessing(false);
  };

  const handlePromote = async () => {
    if (!selectedEmployee) return;

    setIsProcessing(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:promoteEmployee', {
        identifier: selectedEmployee.identifier,
        newGrade: newGrade
      });
      if (response.ok) {
        setShowPromoteModal(false);
        setSelectedEmployee(null);
        loadEmployees();
      }
    } catch {
      // ignore
    }
    setIsProcessing(false);
  };

  const handleFire = async (employee: EmployeeRow) => {
    setIsProcessing(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:fireEmployee', {
        identifier: employee.identifier
      });
      if (response.ok) {
        loadEmployees();
      }
    } catch {
      // ignore
    }
    setIsProcessing(false);
  };

  const handlePayCommission = async (employee: EmployeeRow) => {
    if (!employee.commission_due || employee.commission_due <= 0) return;

    setIsProcessing(true);
    try {
      const response = await fetchNui<{ ok: boolean }>('mdt:payCommission', {
        employeeIdentifier: employee.identifier,
        employeeName: [employee.firstname, employee.lastname].filter(Boolean).join(' ') || employee.identifier,
        amount: employee.commission_due
      });
      if (response.ok) {
        loadEmployees();
      }
    } catch {
      // ignore
    }
    setIsProcessing(false);
  };

  const handleReset = async (identifier: string) => {
    try {
      await fetchNui('mdt:resetEmployeeStats', { identifier });
      loadEmployees();
    } catch {
      // ignore
    }
  };

  // Filter employees
  const filteredEmployees = rows.filter((emp) => {
    if (gradeFilter !== null && emp.job_grade !== gradeFilter) return false;

    if (search) {
      const searchLower = search.toLowerCase();
      const fullName = [emp.firstname, emp.lastname].filter(Boolean).join(' ').toLowerCase();
      return fullName.includes(searchLower) || emp.identifier.toLowerCase().includes(searchLower);
    }
    return true;
  });

  const isBoss = player?.isBoss ?? false;
  const uniqueGrades = [...new Set(rows.map((r) => r.job_grade))].sort((a, b) => b - a);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl">Gestion des employes</h2>
          <p className="text-white/50">
            Recrutement, promotions, commissions et gestion du personnel.
          </p>
        </div>
        {isBoss && (
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowRecruitModal(true);
                handleScanNearby();
              }}
              className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 transition hover:bg-white/5"
            >
              Recruter
            </button>
          </div>
        )}
      </header>

      <section className="grid grid-cols-3 gap-6">
        {[
          { label: 'Effectif', value: rows.length, icon: 'users' },
          {
            label: 'Commissions dues',
            value: currency.format(rows.reduce((sum, row) => sum + (row.commission_due ?? 0), 0)),
            icon: 'money'
          },
          {
            label: 'Ventes 30j',
            value: currency.format(rows.reduce((sum, row) => sum + (row.sales_total ?? 0), 0)),
            icon: 'chart'
          }
        ].map((metric) => (
          <div key={metric.label} className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500/20 text-accent-400">
                <Icon name={metric.icon} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">{metric.label}</p>
                <p className="mt-1 font-display text-2xl">{metric.value}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setGradeFilter(null)}
              className={`rounded-full px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                gradeFilter === null
                  ? 'bg-accent-600 text-base-950 font-medium'
                  : 'border border-white/10 text-white/60 hover:bg-white/5'
              }`}
            >
              Tous
            </button>
            {uniqueGrades.map((grade) => (
              <button
                key={grade}
                onClick={() => setGradeFilter(grade)}
                className={`rounded-full px-4 py-1 text-xs uppercase tracking-[0.2em] transition ${
                  gradeFilter === grade
                    ? 'bg-accent-600 text-base-950 font-medium'
                    : 'border border-white/10 text-white/60 hover:bg-white/5'
                }`}
              >
                Grade {grade}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
              placeholder="Recherche employe..."
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
        ) : filteredEmployees.length === 0 ? (
          <div className="mt-6 text-center text-white/50 py-12">
            <div className="flex justify-center mb-2">
              <Icon name="users" />
            </div>
            <p>Aucun employe trouve</p>
          </div>
        ) : (
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
                {filteredEmployees.map((employee) => (
                  <tr key={employee.identifier} className="border-t border-white/5">
                    <td className="px-6 py-4 font-medium">
                      {[employee.firstname, employee.lastname].filter(Boolean).join(' ') ||
                        employee.identifier.substring(0, 20)}
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {employee.grade_label || `Grade ${employee.job_grade ?? 0}`}
                    </td>
                    <td className="px-6 py-4">{employee.invoices_count ?? 0}</td>
                    <td className="px-6 py-4">
                      {currency.format(employee.sales_total ?? 0)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-accent-500">
                          {currency.format(employee.commission_due ?? 0)}
                        </span>
                        <span className="text-xs text-white/40">
                          {formatPercent(employee.commission_rate)}
                        </span>
                      </div>
                    </td>
                    {isBoss && (
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {(employee.commission_due ?? 0) > 0 && (
                            <button
                              onClick={() => handlePayCommission(employee)}
                              disabled={isProcessing}
                              className="rounded-full bg-accent-600 px-3 py-1 text-xs font-medium text-base-950 disabled:opacity-50"
                            >
                              Payer
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setNewGrade(employee.job_grade);
                              setShowPromoteModal(true);
                            }}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs hover:bg-white/5"
                          >
                            Promouvoir
                          </button>
                          <button
                            onClick={() => handleFire(employee)}
                            disabled={isProcessing}
                            className="rounded-full border border-red-500/50 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            Virer
                          </button>
                          <button
                            onClick={() => handleReset(employee.identifier)}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/5"
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recruit Modal */}
      {showRecruitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display text-xl">Recruter un employe</h3>
            <p className="text-sm text-white/50 mt-1">
              Selectionnez un joueur a proximite ou saisissez son ID.
            </p>

            <div className="mt-4">
              <button
                onClick={handleScanNearby}
                disabled={isScanning}
                className="w-full rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              >
                {isScanning ? 'Scan en cours...' : 'Scanner les joueurs a proximite'}
              </button>
            </div>

            {nearbyPlayers.length > 0 && (
              <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-base-900">
                {nearbyPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleRecruit(p.id)}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 disabled:opacity-50 border-b border-white/5 last:border-0"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-white/50 ml-2">(ID: {p.id})</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <input
                value={recruitPlayerId}
                onChange={(e) => setRecruitPlayerId(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 placeholder:text-white/30"
                placeholder="ID du joueur"
              />
              <button
                onClick={() => recruitPlayerId && handleRecruit(Number(recruitPlayerId))}
                disabled={!recruitPlayerId || isProcessing}
                className="rounded-full bg-accent-600 px-4 py-2 text-sm font-medium text-base-950 disabled:opacity-50"
              >
                Recruter
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowRecruitModal(false);
                  setNearbyPlayers([]);
                  setRecruitPlayerId('');
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote Modal */}
      {showPromoteModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6">
            <h3 className="font-display text-xl">Promouvoir l'employe</h3>
            <p className="text-sm text-white/50 mt-1">
              {[selectedEmployee.firstname, selectedEmployee.lastname].filter(Boolean).join(' ') ||
                selectedEmployee.identifier}
            </p>

            <div className="mt-4">
              <label className="text-xs uppercase tracking-[0.2em] text-white/50">
                Nouveau grade
              </label>
              <select
                value={newGrade}
                onChange={(e) => setNewGrade(Number(e.target.value))}
                className="mt-2 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70"
              >
                {jobGrades.length > 0 ? (
                  jobGrades.map((g) => (
                    <option key={g.grade} value={g.grade}>
                      {g.label} (Grade {g.grade})
                    </option>
                  ))
                ) : (
                  [0, 1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPromoteModal(false);
                  setSelectedEmployee(null);
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                onClick={handlePromote}
                disabled={isProcessing}
                className="rounded-full bg-accent-600 px-4 py-2 text-sm font-medium text-base-950 disabled:opacity-50"
              >
                {isProcessing ? 'En cours...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
