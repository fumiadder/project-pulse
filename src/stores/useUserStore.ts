import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { api } from '@/services/api';

interface UserStore {
  currentUser: User | null;
  users: User[];
  isLoggedIn: boolean;
  login: (username: string, password: string) => string; // returns 'ok' | 'username_not_found' | 'password_wrong' | 'user_not_loaded'
  logout: () => void;
  switchUser: (userId: string) => Promise<void>;
  loadUsers: () => Promise<void>;
  addUser: (user: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  updateCurrentUser: (user: User) => void;
}

// LOGIN_ACCOUNTS maps username -> { id, password }
const LOGIN_ACCOUNTS: Record<string, { id: string; password: string }> = {
  '唐宝': { id: 'user_tangbao', password: 'tangbao' },
  '周刚': { id: 'user_zhougang', password: 'zhougang' },
  '杨利莉': { id: 'user_yanglili', password: 'yanglili' },
  '常超': { id: 'user_changchao', password: 'changchao' },
};

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [],
      isLoggedIn: false,

      login: async (username, password) => {
        const account = LOGIN_ACCOUNTS[username];
        if (!account) return 'username_not_found';
        if (password !== account.password) return 'password_wrong';
        // Ensure users is always an array
        const currentUsers = Array.isArray(get().users) ? get().users : [];
        let user = currentUsers.find(u => u.id === account.id);
        // If users not loaded yet, try to load from backend first
        if (!user) {
          try {
            const res = await api.listUsers();
            const users = res.data?.users ?? (Array.isArray(res.data) ? res.data : []) ?? [];
            set({ users });
            user = users.find((u: User) => u.id === account.id);
          } catch (e) {
            console.error('Failed to load users on login:', e);
          }
        }
        // Fallback: create a temporary user object
        if (!user) {
          user = {
            id: account.id,
            name: username,
            role: 'member',
            color: '#00d4ff',
            createdAt: new Date().toISOString()
          };
          set({ users: [...currentUsers, user] });
        }
        set({ currentUser: user, isLoggedIn: true });
        // 只存储 user ID，不存储登录状态（登录状态必须通过验证恢复）
        localStorage.setItem('pp_current_user', account.id);
        return 'ok';
      },

      logout: () => {
        localStorage.removeItem('pp_current_user');
        set({ currentUser: null, isLoggedIn: false });
      },

      switchUser: async (userId) => {
        const user = get().users.find(u => u.id === userId);
        if (user) {
          set({ currentUser: user });
          localStorage.setItem('pp_current_user', userId);
        }
      },

      loadUsers: async () => {
        try {
          // 清理旧版遗留的登录标记
          localStorage.removeItem('pp_logged_in');
          localStorage.removeItem('pp_remember');
          
          const res = await api.listUsers();
          const users = res.data?.users ?? (Array.isArray(res.data) ? res.data : []) ?? [];
          set({ users });
          // 从 localStorage 恢复会话：仅当用户在后台数据中存在时才恢复
          const savedUserId = localStorage.getItem('pp_current_user');
          if (savedUserId) {
            const user = users.find((u: User) => u.id === savedUserId);
            if (user) {
              // 验证成功：用户存在于后台，恢复登录状态
              set({ currentUser: user, isLoggedIn: true });
            } else {
              // 验证失败：用户不存在于后台，清除残留会话
              localStorage.removeItem('pp_current_user');
              set({ currentUser: null, isLoggedIn: false });
            }
          }
        } catch (e) {
          console.error('Failed to load users:', e);
          // API 加载失败时，不恢复任何会话
          set({ isLoggedIn: false });
        }
      },

      addUser: async (user) => {
        await api.putUser(user);
        set(state => ({ users: [...state.users, user] }));
      },

      deleteUser: async (userId) => {
        await api.deleteUser(userId);
        set(state => ({
          users: state.users.filter(u => u.id !== userId),
          currentUser: state.currentUser?.id === userId ? null : state.currentUser,
          isLoggedIn: state.currentUser?.id === userId ? false : state.isLoggedIn,
        }));
      },

      updateCurrentUser: async (user) => {
        const res = await api.putUser(user);
        if (!res.success) throw new Error(res.error || '保存失败');
        set(state => ({
          currentUser: user,
          users: state.users.map(u => u.id === user.id ? user : u),
        }));
      },
    }),
    {
      name: 'pp-user-store',
      // 不持久化任何状态：登录状态必须通过 loadUsers() 验证后恢复
      partialize: () => ({}),
    }
  )
);
