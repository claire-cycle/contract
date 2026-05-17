import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CustomChain {
  id: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrencySymbol: string;
  nativeCurrencyName: string;
  nativeCurrencyDecimals: number;
  color: string;
}

interface ChainState {
  selectedChainId: number;
  customRpcs: Record<number, string>;
  customChains: CustomChain[];
}

interface ChainActions {
  setChain: (chainId: number) => void;
  setCustomRpc: (chainId: number, url: string) => void;
  removeCustomRpc: (chainId: number) => void;
  addCustomChain: (chain: CustomChain) => void;
  removeCustomChain: (chainId: number) => void;
  updateCustomChain: (chainId: number, updates: Partial<CustomChain>) => void;
}

type ChainStore = ChainState & ChainActions;

export const useChainStore = create<ChainStore>()(
  persist(
    (set) => ({
      selectedChainId: 1,
      customRpcs: {},
      customChains: [],

      setChain: (chainId: number) => set({ selectedChainId: chainId }),

      setCustomRpc: (chainId: number, url: string) =>
        set((state) => ({
          customRpcs: { ...state.customRpcs, [chainId]: url },
        })),

      removeCustomRpc: (chainId: number) =>
        set((state) => {
          const { [chainId]: _, ...rest } = state.customRpcs;
          return { customRpcs: rest };
        }),

      addCustomChain: (chain: CustomChain) =>
        set((state) => ({
          customChains: [...state.customChains, chain],
        })),

      removeCustomChain: (chainId: number) =>
        set((state) => ({
          customChains: state.customChains.filter((c) => c.id !== chainId),
        })),

      updateCustomChain: (chainId: number, updates: Partial<CustomChain>) =>
        set((state) => ({
          customChains: state.customChains.map((c) =>
            c.id === chainId ? { ...c, ...updates } : c
          ),
        })),
    }),
    {
      name: 'chain-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
