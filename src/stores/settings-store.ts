import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: Theme;
  defaultChainId: number;
}

interface SettingsActions {
  setTheme: (theme: Theme) => void;
  setDefaultChainId: (chainId: number) => void;
}

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'system',
      defaultChainId: 1,

      setTheme: (theme) => set({ theme }),

      setDefaultChainId: (chainId) => set({ defaultChainId: chainId }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
