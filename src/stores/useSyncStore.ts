import { create } from 'zustand';
import { api } from '@/services/api';

interface SyncStore {
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncedAt: string | null;
  fullSync: () => Promise<void>;
}

export const useSyncStore = create<SyncStore>((set) => ({
  syncStatus: 'idle',
  lastSyncedAt: null,

  fullSync: async () => {
    set({ syncStatus: 'syncing' });
    try {
      const res = await api.fullSyncGet();
      if (res.success && res.data) {
        set({
          syncStatus: 'success',
          lastSyncedAt: new Date().toISOString(),
        });
      } else {
        set({ syncStatus: 'error' });
      }
    } catch {
      set({ syncStatus: 'error' });
    }
  },
}));
