import { create } from 'zustand';
import type { ContractInfo } from '@/types';
import type { AbiMethod } from '@/lib/abi/parser';

export type { AbiMethod };

interface ContractState {
  currentContract: ContractInfo | null;
  abi: AbiMethod[];
  isLoading: boolean;
  error: string | null;
}

interface ContractActions {
  setContract: (contract: ContractInfo | null) => void;
  setAbi: (methods: AbiMethod[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

type ContractStore = ContractState & ContractActions;

const initialState: ContractState = {
  currentContract: null,
  abi: [],
  isLoading: false,
  error: null,
};

export const useContractStore = create<ContractStore>()((set) => ({
  ...initialState,

  setContract: (contract) =>
    set({ currentContract: contract, error: null }),

  setAbi: (methods) => set({ abi: methods }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  clear: () => set(initialState),
}));
