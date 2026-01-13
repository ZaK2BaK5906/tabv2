import { create } from 'zustand';

interface UiState {
  isOpen: boolean;
  setOpen: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isOpen: false,
  setOpen: (value) => set({ isOpen: value })
}));
