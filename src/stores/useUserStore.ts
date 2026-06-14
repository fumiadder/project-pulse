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
        localStorage.setItem('pp_current_user', account.id);
        localStorage.setItem('pp_logged_in', 'true');
        return 'ok';
      },

      logout: () => {
        localStorage.removeItem('pp_current_user');
        localStorage.removeItem('pp_logged_in');
        localStorage.removeItem('pp_remember');
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
          const res = await api.listUsers();
          const users = res.data?.users ?? (Array.isArray(res.data) ? res.data : []) ?? [];
          set({ users });
          // Restore session
          const savedUserId = localStorage.getItem('pp_current_user');
          const isLoggedIn = localStorage.getItem('pp_logged_in');
          if (isLoggedIn && savedUserId) {
            const user = users.find((u: User) => u.id === savedUserId);
            if (user) set({ currentUser: user, isLoggedIn: true });
          }
        } catch (e) {
          console.error('Failed to load users:', e);
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
      partialize: (state) => ({ isLoggedIn: state.isLoggedIn }),
    }
  )
);
