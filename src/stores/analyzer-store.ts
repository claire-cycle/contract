import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SavedSelector {
  selector: string;
  signature?: string;
  confidence: string;
  source: string;
}

export interface SavedProxyInfo {
  isProxy: boolean;
  type?: string;
  implementationAddress?: string;
}

export interface AnalysisRecord {
  id: string;
  address: string;
  chainId: number;
  bytecode: string;
  bytecodeSize: number;
  selectors: SavedSelector[];
  proxy: SavedProxyInfo;
  contractType?: string;
  aiResult?: string;
  timestamp: number;
}

interface AnalyzerState {
  records: AnalysisRecord[];
  /** ID of the currently active record (restored after navigation) */
  activeId: string | null;
}

interface AnalyzerActions {
  addRecord: (record: AnalysisRecord) => void;
  removeRecord: (id: string) => void;
  setActive: (id: string | null) => void;
  updateAiResult: (id: string, result: string) => void;
}

type AnalyzerStore = AnalyzerState & AnalyzerActions;

export const useAnalyzerStore = create<AnalyzerStore>()(
  persist(
    (set) => ({
      records: [],
      activeId: null,

      addRecord: (record) =>
        set((state) => {
          // Keep max 50 records, newest first
          const records = [record, ...state.records].slice(0, 50);
          return { records, activeId: record.id };
        }),

      removeRecord: (id) =>
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
        })),

      setActive: (id) => set({ activeId: id }),

      updateAiResult: (id, result) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, aiResult: result } : r
          ),
        })),
    }),
    {
      name: 'analyzer-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
