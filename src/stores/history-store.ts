import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  chainId: number;
  value: string;
  data: string;
  method: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: string;
  gasPrice?: string;
  effectiveGasPrice?: string;
  nonce?: number;
  blockNumber?: string;
}

interface HistoryState {
  transactions: Transaction[];
}

interface HistoryActions {
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  clearHistory: () => void;
}

type HistoryStore = HistoryState & HistoryActions;

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      transactions: [],

      addTransaction: (tx) =>
        set((state) => ({
          transactions: [tx, ...state.transactions],
        })),

      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, ...updates } : tx
          ),
        })),

      clearHistory: () => set({ transactions: [] }),
    }),
    {
      name: 'history-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
