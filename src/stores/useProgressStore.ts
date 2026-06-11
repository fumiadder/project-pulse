import { create } from 'zustand';
import type { Progress } from '@/types';
import { api } from '@/services/api';

// 安全解析可能为 JSON 数组或逗号分隔文本的字段
function safeParseArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  if (typeof val === 'string') {
    try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : [val]; }
    catch { return val.split(',').map((s: string) => s.trim()).filter(Boolean); }
  }
  return [];
}

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

// Safe array getter - guards against undefined from localStorage persist
const safeEntries = (state: { entries?: Progress[] }): Progress[] =>
  Array.isArray(state.entries) ? state.entries : [];

export const useProgressStore = create<ProgressStore>((set, get) => ({
  entries: [],
  isLoading: false,

  loadProgress: async (userId?: string, projectId?: string) => {
    set({ isLoading: true });
    try {
      const res = await api.listProgress(userId, projectId);
      const raw = res.data?.progress ?? (Array.isArray(res.data) ? res.data : []) ?? [];
      // Parse JSON string fields from SQLite
      const entries = raw.map((e: any) => ({
        ...e,
        attachments: safeParseArray(e.attachments),
        collaborators: safeParseArray(e.collaborators),
      }));
      set({ entries });
    } finally {
      set({ isLoading: false });
    }
  },

  addEntry: async (entry) => {
    await api.putProgress(entry);
    set(state => ({ entries: [...safeEntries(state), entry] }));
  },

  updateEntry: async (entry) => {
    await api.putProgress(entry);
    set(state => ({
      entries: safeEntries(state).map(e => e.id === entry.id ? entry : e),
    }));
  },

  deleteEntry: async (id) => {
    await api.deleteProgress(id);
    set(state => ({ entries: safeEntries(state).filter(e => e.id !== id) }));
  },

  getByProject: (projectId) =>
    safeEntries(get()).filter(e => e.projectId === projectId),

  getByUser: (userId) =>
    safeEntries(get()).filter(e => e.userId === userId),

  getByDate: (date) =>
    safeEntries(get()).filter(e => e.date === date),

  getLatestByProject: (projectId) => {
    const entries = safeEntries(get())
      .filter(e => e.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return entries[0];
  },
}));
