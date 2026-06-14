import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useUserStore } from '@/stores/useUserStore';

const REMEMBER_KEY = 'pp_remember_credentials';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface SavedCredentials {
  username: string;
  password: string;
  expiry: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  username_not_found: '用户名不存在',
  password_wrong: '密码错误',
  user_not_loaded: '用户数据未加载，请稍后重试',
};

export function LoginPage() {
  const { login, users, loadUsers } = useUserStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    doLogin();
  };

  const doLogin = () => {
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setLoading(true);

    const tryLogin = async () => {
      // Ensure users are loaded
      if (users.length === 0) {
        await loadUsers();
      }
      // Simulate a brief delay for UX
      await new Promise(r => setTimeout(r, 300));
      const result = await login(username.trim(), password);
      if (result !== 'ok') {
        setError(ERROR_MESSAGES[result] ?? '登录失败');
      } else {
        if (remember) {
          const creds: SavedCredentials = {
            username: username.trim(),
            password,
            expiry: Date.now() + SEVEN_DAYS_MS,
          };
          localStorage.setItem(REMEMBER_KEY, JSON.stringify(creds));
        }
      }
      setLoading(false);
    };

    tryLogin();
  };

  // On mount: check for saved credentials and auto-login
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const tryAutoLogin = async () => {
      try {
        const raw = localStorage.getItem(REMEMBER_KEY);
        if (!raw) return;

        const creds: SavedCredentials = JSON.parse(raw);
        if (!creds.username || !creds.password || !creds.expiry) return;

        // Check expiry
        if (Date.now() > creds.expiry) {
          localStorage.removeItem(REMEMBER_KEY);
          return;
        }

        // Ensure users are loaded before attempting login
        if (users.length === 0) {
          await loadUsers();
        }

        // Auto-fill and auto-submit
        setUsername(creds.username);
        setPassword(creds.password);
        setRemember(true);

        // Auto-submit login
        setLoading(true);
        setTimeout(async () => {
          const result = await login(creds.username, creds.password);
          if (result !== 'ok') {
            setError(ERROR_MESSAGES[result] ?? '登录失败');
            localStorage.removeItem(REMEMBER_KEY);
          }
          setLoading(false);
        }, 300);
      } catch {
        localStorage.removeItem(REMEMBER_KEY);
      }
    };

    tryAutoLogin();
  }, [users.length, loadUsers]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-primary p-4">
      {/* Grid pattern overlay is applied via CSS on body */}

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-accent-cyan/20 via-transparent to-accent-cyan/10 blur-xl opacity-50" />

        {/* Login Card */}
        <div className="card-glass relative p-8">
          {/* Scan line effect */}
          <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none scan-line" />

          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl border border-accent-cyan/20 bg-bg-tertiary/50 glow-cyan">
              <i className="fas fa-satellite-dish text-2xl text-accent-cyan" />
            </div>
            <h1 className="text-xl font-bold tracking-widest text-accent-cyan font-display">
              PROJECT PULSE
            </h1>
            <p className="mt-1 text-xs text-text-muted">
              项目进度管理系统
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                <i className="fas fa-user mr-1.5 text-accent-cyan/60" />
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="h-10 w-full rounded-lg border border-border-custom bg-bg-primary/50 px-3 text-sm text-text-primary placeholder:text-text-muted/50 outline-none transition-all focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20"
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                <i className="fas fa-lock mr-1.5 text-accent-cyan/60" />
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="h-10 w-full rounded-lg border border-border-custom bg-bg-primary/50 px-3 text-sm text-text-primary placeholder:text-text-muted/50 outline-none transition-all focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20"
                autoComplete="current-password"
              />
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-border-custom bg-bg-primary accent-accent-cyan cursor-pointer"
              />
              <label
                htmlFor="remember"
                className="text-xs text-text-secondary cursor-pointer select-none"
              >
                记住登录状态
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-accent-red/20 bg-accent-red/5 px-3 py-2 text-xs text-accent-red animate-fade-in-up">
                <i className="fas fa-exclamation-circle" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="relative h-10 w-full overflow-hidden rounded-lg bg-gradient-to-r from-accent-cyan to-cyan-400 text-sm font-semibold text-bg-primary transition-all hover:shadow-lg hover:shadow-accent-cyan/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-spinner fa-spin" />
                  登录中...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-sign-in-alt" />
                  登录系统
                </span>
              )}
            </button>
          </form>

          {/* Footer hint */}
          <div className="mt-6 text-center">
            <p className="text-[10px] text-text-muted">
              <i className="fas fa-info-circle mr-1" />
              测试账号: 唐宝 / 唐宝, 周刚 / 周刚
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
