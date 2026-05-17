import { create } from 'zustand';

type ActiveTab = string;

interface UiState {
  sidebarOpen: boolean;
  activeTab: ActiveTab;
}

interface UiActions {
  toggleSidebar: () => void;
  setActiveTab: (tab: ActiveTab) => void;
}

type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>()((set) => ({
  sidebarOpen: true,
  activeTab: 'contract',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setActiveTab: (tab) => set({ activeTab: tab }),
}));

/** Alias for backward compatibility with existing components */
export const useUIStore = useUiStore;
