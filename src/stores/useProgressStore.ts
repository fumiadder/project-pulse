import { create } from 'zustand';
import type { Progress } from '@/types';
import { api } from '@/services/api';

interface ProgressStore {
  entries: Progress[];
  isLoading: boolean;
  loadProgress: (userId?: string, projectId?: string) => Promise<void>;
  addEntry: (entry: Progress) => Promise<void>;
  updateEntry: (entry: Progress) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getByProject: (projectId: string) => Progress[];
  getByUser: (userId: string) => Progress[];
  getByDate: (date: string) => Progress[];
  getLatestByProject: (projectId: string) => Progress | undefined;
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  entries: [],
  isLoading: false,

  loadProgress: async (userId?: string, projectId?: string) => {
    set({ isLoading: true });
    try {
      const res = await api.listProgress(userId, projectId);
      const entries = res.data?.progress ?? (res.data as unknown as Progress[]) ?? [];
      set({ entries });
    } finally {
      set({ isLoading: false });
    }
  },

  addEntry: async (entry) => {
    await api.putProgress(entry);
    set(state => ({ entries: [...state.entries, entry] }));
  },

  updateEntry: async (entry) => {
    await api.putProgress(entry);
    set(state => ({
      entries: state.entries.map(e => e.id === entry.id ? entry : e),
    }));
  },

  deleteEntry: async (id) => {
    await api.deleteProgress(id);
    set(state => ({ entries: state.entries.filter(e => e.id !== id) }));
  },

  getByProject: (projectId) =>
    get().entries.filter(e => e.projectId === projectId),

  getByUser: (userId) =>
    get().entries.filter(e => e.userId === userId),

  getByDate: (date) =>
    get().entries.filter(e => e.date === date),

  getLatestByProject: (projectId) => {
    const entries = get().entries
      .filter(e => e.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return entries[0];
  },
}));
