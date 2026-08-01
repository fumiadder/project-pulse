import { create } from 'zustand';
import type { CheckIn } from '@/types';
import { api } from '@/services/api';

/** 安全解析 history 字段 */
function safeParseHistory(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

interface CheckinStore {
  checkins: CheckIn[];
  isLoading: boolean;
  loadCheckins: (userId?: string) => Promise<void>;
  addCheckin: (checkin: CheckIn) => Promise<void>;
  updateCheckin: (checkin: CheckIn) => Promise<void>;
  deleteCheckin: (id: string) => Promise<void>;
  toggleToday: (id: string) => Promise<void>;
}

const safeCheckins = (state: { checkins?: CheckIn[] }): CheckIn[] =>
  Array.isArray(state.checkins) ? state.checkins : [];

/** 获取今天的日期字符串 YYYY-MM-DD */
function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useCheckinStore = create<CheckinStore>((set, get) => ({
  checkins: [],
  isLoading: false,

  loadCheckins: async (userId?: string) => {
    set({ isLoading: true });
    try {
      const res = await api.listCheckIns(userId);
      const raw = res.data ?? [];
      const checkins = raw.map((c: any) => ({
        ...c,
        history: safeParseHistory(c.history),
        pinned: c.pinned ?? false,
      }));
      set({ checkins });
    } finally {
      set({ isLoading: false });
    }
  },

  addCheckin: async (checkin) => {
    const res = await api.putCheckIn(checkin);
    if (!res.success) {
      throw new Error(res.error || '创建打卡项失败');
    }
    set((state) => ({ checkins: [checkin, ...safeCheckins(state)] }));
  },

  updateCheckin: async (checkin) => {
    await api.putCheckIn(checkin);
    set((state) => ({
      checkins: safeCheckins(state).map((c) => (c.id === checkin.id ? checkin : c)),
    }));
  },

  deleteCheckin: async (id) => {
    await api.deleteCheckIn(id);
    set((state) => ({ checkins: safeCheckins(state).filter((c) => c.id !== id) }));
  },

  toggleToday: async (id) => {
    const checkin = safeCheckins(get()).find((c) => c.id === id);
    if (!checkin) return;
    const today = getTodayStr();
    const alreadyDone = checkin.lastDoneDate === today;
    const now = new Date().toISOString();

    let newStreak = checkin.streak;
    let newHistory = [...checkin.history];

    if (alreadyDone) {
      // 取消今日打卡
      newStreak = Math.max(0, checkin.streak - 1);
      newHistory = newHistory.filter(d => d !== today);
    } else {
      // 完成今日打卡
      newStreak = checkin.streak + 1;
      if (!newHistory.includes(today)) {
        newHistory.push(today);
      }
    }

    const updated: CheckIn = {
      ...checkin,
      streak: newStreak,
      lastDoneDate: alreadyDone ? null : today,
      history: newHistory,
      updatedAt: now,
    };
    await get().updateCheckin(updated);
  },
}));
