import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: Theme;
  defaultChainId: number;
  etherscanApiKey: string;
}

interface SettingsActions {
  setTheme: (theme: Theme) => void;
  setDefaultChainId: (chainId: number) => void;
  setEtherscanApiKey: (key: string) => void;
}

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'system',
      defaultChainId: 1,
      etherscanApiKey: '',

      setTheme: (theme) => set({ theme }),

      setDefaultChainId: (chainId) => set({ defaultChainId: chainId }),

      setEtherscanApiKey: (key) => set({ etherscanApiKey: key }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
