import { create } from 'zustand';

/** 通知类型 */
export type NotificationType = 'reminder' | 'overdue' | 'due_today';

/** 通知项 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  todoId?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationStore {
  notifications: AppNotification[];
  addNotification: (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  removeNotification: (id: string) => void;
  /** 未读数量 */
  unreadCount: () => number;
}

/** 生成唯一 ID */
function genId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (n) => {
    const notification: AppNotification = {
      ...n,
      id: genId(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    // 避免短时间内重复添加相同 todoId+type 的通知
    const existing = get().notifications.find(
      (x) => x.todoId === n.todoId && x.type === n.type && !x.read,
    );
    if (existing) return;

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
    }));
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
