import { create } from 'zustand';

interface UIStore {
  activePage: string;
  sidebarCollapsed: boolean;
  setActivePage: (page: string) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activePage: 'dashboard',
  sidebarCollapsed: false,

  setActivePage: (page) => set({ activePage: page }),

  toggleSidebar: () =>
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
