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

        try {
          // 从后台加载用户列表
          const res = await api.listUsers();
          const users = res.data?.users ?? (Array.isArray(res.data) ? res.data : []) ?? [];
          set({ users });

          // 用用户名匹配后台用户（比 ID 更可靠）
          let user = users.find((u: User) => u.name === username);

          // 如果后台没有这个用户，自动创建并保存到后台
          if (!user) {
            user = {
              id: account.id,
              name: username,
              role: 'member',
              color: '#00d4ff',
              createdAt: new Date().toISOString()
            };
            try {
              await api.putUser(user);
              set(state => ({ users: [...state.users, user] }));
            } catch (e) {
              console.error('Failed to create user on backend:', e);
            }
          }

          set({ currentUser: user, isLoggedIn: true });
          // 存储用户名（用用户名恢复会话更可靠）
          localStorage.setItem('pp_current_username', username);
          return 'ok';
        } catch (e) {
          console.error('Login failed:', e);
          // API 不可用时的降级处理：创建临时用户
          const user = {
            id: account.id,
            name: username,
            role: 'member',
            color: '#00d4ff',
            createdAt: new Date().toISOString()
          };
          set({ currentUser: user, isLoggedIn: true, users: [user] });
          localStorage.setItem('pp_current_username', username);
          return 'ok';
        }
      },

      logout: () => {
        localStorage.removeItem('pp_current_username');
        localStorage.removeItem('pp_current_user'); // 清理旧版
        set({ currentUser: null, isLoggedIn: false });
      },

      switchUser: async (userId) => {
        const user = get().users.find(u => u.id === userId);
        if (user) {
          set({ currentUser: user });
          localStorage.setItem('pp_current_username', user.name);
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

          // 从 localStorage 恢复会话：用用户名匹配（比 ID 更可靠）
          const savedUsername = localStorage.getItem('pp_current_username')
            || (() => {
              // 兼容旧版：从 pp_current_user 迁移
              const oldId = localStorage.getItem('pp_current_user');
              if (oldId) {
                const matched = Object.entries(LOGIN_ACCOUNTS).find(
                  ([, acc]) => acc.id === oldId
                );
                if (matched) {
                  localStorage.setItem('pp_current_username', matched[0]);
                  localStorage.removeItem('pp_current_user');
                  return matched[0];
                }
              }
              return null;
            })();

          if (savedUsername) {
            // 验证：用户必须存在于 LOGIN_ACCOUNTS 且存在于后台用户列表
            const validAccount = LOGIN_ACCOUNTS[savedUsername];
            const user = users.find((u: User) => u.name === savedUsername);
            if (validAccount && user) {
              // 验证成功
              set({ currentUser: user, isLoggedIn: true });
            } else {
              // 验证失败，清除残留会话
              localStorage.removeItem('pp_current_username');
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
