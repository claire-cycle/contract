import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AiProvider = 'claude' | 'openai' | 'glm' | 'deepseek' | 'minimax' | 'mimo' | 'qwen' | 'ollama' | 'custom';

export interface AnalysisResult {
  id: string;
  input: string;
  output: string;
  provider: AiProvider;
  modelId: string;
  timestamp: number;
}

interface AiState {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  ollamaUrl: string;
  modelId: string;
  isLoading: boolean;
  results: AnalysisResult[];
}

interface AiActions {
  setProvider: (provider: AiProvider) => void;
  setApiKey: (apiKey: string) => void;
  setBaseUrl: (url: string) => void;
  setOllamaUrl: (url: string) => void;
  setModelId: (modelId: string) => void;
  setLoading: (loading: boolean) => void;
  addResult: (result: AnalysisResult) => void;
  clearResults: () => void;
}

type AiStore = AiState & AiActions;

export const useAiStore = create<AiStore>()(
  persist(
    (set) => ({
      provider: 'claude',
      apiKey: '',
      baseUrl: '',
      ollamaUrl: 'http://localhost:11434',
      modelId: '',
      isLoading: false,
      results: [],

      setProvider: (provider) => set({ provider }),

      setApiKey: (apiKey) => set({ apiKey }),

      setBaseUrl: (url) => set({ baseUrl: url }),

      setOllamaUrl: (url) => set({ ollamaUrl: url }),

      setModelId: (modelId) => set({ modelId }),

      setLoading: (loading) => set({ isLoading: loading }),

      addResult: (result) =>
        set((state) => ({ results: [...state.results, result] })),

      clearResults: () => set({ results: [] }),
    }),
    {
      name: 'ai-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        provider: state.provider,
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
        ollamaUrl: state.ollamaUrl,
        modelId: state.modelId,
      }),
    },
  ),
);
