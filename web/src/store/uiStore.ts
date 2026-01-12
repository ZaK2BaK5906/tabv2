import { create } from 'zustand';

interface UiState {
  isReady: boolean;
  setReady: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isReady: false,
  setReady: (value) => set({ isReady: value })
}));
