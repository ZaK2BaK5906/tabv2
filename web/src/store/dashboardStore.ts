import { create } from 'zustand';
import { fetchNui } from '../features/nui';

export interface DashboardStats {
  totalInvoiced: number;
  taxesDue: number;
  commissionsTotal: number;
  employeesCount: number;
  myInvoicesCount: number;
  mySalesTotal: number;
  myCommissionDue: number;
}

interface DashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
}

const defaultStats: DashboardStats = {
  totalInvoiced: 0,
  taxesDue: 0,
  commissionsTotal: 0,
  employeesCount: 0,
  myInvoicesCount: 0,
  mySalesTotal: 0,
  myCommissionDue: 0
};

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  isLoading: false,
  error: null,

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetchNui<{
        ok: boolean;
        stats?: DashboardStats;
        reason?: string;
      }>('mdt:getDashboardStats');

      if (response.ok && response.stats) {
        set({ stats: response.stats, isLoading: false });
      } else {
        set({ stats: defaultStats, isLoading: false });
      }
    } catch (err) {
      set({ stats: defaultStats, error: 'Erreur de connexion', isLoading: false });
    }
  }
}));
