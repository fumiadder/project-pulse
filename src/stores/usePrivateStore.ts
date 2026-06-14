import { create } from 'zustand';
import type { Idea, Project } from '@/types';
import { api } from '@/services/api';

interface PrivateStore {
  ideas: Idea[];
  isUnlocked: boolean;
  unlockExpiry: number | null;
  isLoading: boolean;

  loadIdeas: (userId: string) => Promise<void>;
  addIdea: (idea: Idea) => Promise<void>;
  updateIdea: (idea: Idea) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  landIdea: (ideaId: string, projectData: Partial<Project>) => Promise<string>;

  verifyPassword: (userId: string, password: string) => Promise<boolean>;
  unlock: (userId: string) => void;
  lock: () => void;
  checkUnlockStatus: (userId: string) => boolean;
}

const UNLOCK_DURATION_MS = 30 * 60 * 1000;

export const usePrivateStore = create<PrivateStore>((set, get) => ({
  ideas: [],
  isUnlocked: false,
  unlockExpiry: null,
  isLoading: false,

  loadIdeas: async (userId) => {
    set({ isLoading: true });
    try {
      const res = await api.listIdeas(userId);
      const ideas = Array.isArray(res.data) ? res.data : (res.data?.ideas ?? []);
      set({ ideas });
    } finally {
      set({ isLoading: false });
    }
  },

  addIdea: async (idea) => {
    const res = await api.putIdea(idea);
    if (!res.success) throw new Error(res.error || '创建失败');
    set(state => ({ ideas: [...state.ideas, res.data ?? idea] }));
  },

  updateIdea: async (idea) => {
    const res = await api.putIdea(idea);
    if (!res.success) throw new Error(res.error || '更新失败');
    set(state => ({
      ideas: state.ideas.map(i => i.id === idea.id ? (res.data ?? idea) : i),
    }));
  },

  deleteIdea: async (id) => {
    const res = await api.deleteIdea(id);
    if (!res.success) throw new Error(res.error || '删除失败');
    set(state => ({ ideas: state.ideas.filter(i => i.id !== id) }));
  },

  landIdea: async (ideaId, projectData) => {
    const idea = get().ideas.find(i => i.id === ideaId);
    if (!idea) throw new Error('想法不存在');

    const res = await api.landIdea(ideaId, projectData);
    if (!res.success || !res.data?.projectId) {
      throw new Error(res.error || '落地失败');
    }

    const projectId = res.data.projectId;
    const updated: Idea = {
      ...idea,
      status: 'landed',
      landedProjectId: projectId,
      updatedAt: new Date().toISOString(),
    };
    await get().updateIdea(updated);
    return projectId;
  },

  verifyPassword: async (userId, password) => {
    // 通过 settings API 获取私密密码进行比对（避免 /api/auth 路由被代理拦截）
    const res = await api.getSetting(`private_password:${userId}`);
    if (!res.success || !res.data?.value) return false;
    return res.data.value === password;
  },

  unlock: (userId) => {
    const expiry = Date.now() + UNLOCK_DURATION_MS;
    set({ isUnlocked: true, unlockExpiry: expiry });
    localStorage.setItem(`pp-private-unlocked-${userId}`, String(expiry));
  },

  lock: () => {
    set({ isUnlocked: false, unlockExpiry: null });
  },

  checkUnlockStatus: (userId) => {
    const saved = localStorage.getItem(`pp-private-unlocked-${userId}`);
    if (!saved) return false;
    const expiry = parseInt(saved, 10);
    if (Date.now() > expiry) {
      localStorage.removeItem(`pp-private-unlocked-${userId}`);
      set({ isUnlocked: false, unlockExpiry: null });
      return false;
    }
    set({ isUnlocked: true, unlockExpiry: expiry });
    return true;
  },
}));
