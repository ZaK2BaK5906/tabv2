import { create } from 'zustand';
import { fetchNui } from '../features/nui';

export interface PlayerJob {
  name: string;
  label: string;
  grade: number;
  gradeName: string;
  gradeLabel: string;
}

export interface PlayerData {
  identifier: string;
  firstname: string;
  lastname: string;
  fullname: string;
  job: PlayerJob | null;
  money: {
    cash: number;
    bank: number;
  };
  isBoss: boolean;
}

interface PlayerState {
  player: PlayerData | null;
  isLoading: boolean;
  error: string | null;
  fetchPlayer: () => Promise<void>;
  clearPlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  player: null,
  isLoading: false,
  error: null,

  fetchPlayer: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetchNui<{
        ok: boolean;
        player?: PlayerData;
        reason?: string;
      }>('mdt:getPlayerData');

      if (response.ok && response.player) {
        set({ player: response.player, isLoading: false });
      } else {
        set({ error: response.reason || 'Erreur inconnue', isLoading: false });
      }
    } catch (err) {
      set({ error: 'Erreur de connexion', isLoading: false });
    }
  },

  clearPlayer: () => set({ player: null, isLoading: false, error: null })
}));
