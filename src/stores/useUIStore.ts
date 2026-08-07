import { create } from 'zustand';

interface UIStore {
  activePage: string;
  sidebarCollapsed: boolean;
  mobilePreview: boolean;
  setActivePage: (page: string) => void;
  toggleSidebar: () => void;
  toggleMobilePreview: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activePage: 'workbench',
  sidebarCollapsed: false,
  mobilePreview: false,

  setActivePage: (page) => set({ activePage: page }),

  toggleSidebar: () =>
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  toggleMobilePreview: () =>
    set(state => ({ mobilePreview: !state.mobilePreview })),
}));
