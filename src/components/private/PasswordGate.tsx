interface PasswordGateProps {
  password: string;
  setPassword: (v: string) => void;
  onVerify: () => void;
  error: string;
}

export function PasswordGate({ password, setPassword, onVerify, error }: PasswordGateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 animate-fade-in-up">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-cyan/10 border border-accent-cyan/20">
        <i className="fas fa-lock text-2xl text-accent-cyan" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-text-primary">私密空间</h2>
        <p className="text-sm text-text-muted mt-1">请输入私密密码以查看内容</p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onVerify()}
          placeholder="输入密码"
          className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-4 py-2.5 text-sm text-text-primary text-center focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
        />
        {error && <p className="text-xs text-accent-red text-center">{error}</p>}
        <button
          onClick={onVerify}
          className="w-full rounded-lg bg-accent-cyan px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-cyan/80"
        >
          解锁
        </button>
      </div>
    </div>
  );
}
