interface StatCardProps {
  title: string;
  value: number | string;
  icon: string;
  color: 'cyan' | 'green' | 'orange' | 'purple' | 'yellow';
  onClick?: () => void;
}

const colorMap = {
  cyan: {
    icon: 'text-accent-cyan',
    glow: 'shadow-[0_0_15px_rgba(0,212,255,0.15)]',
    border: 'border-accent-cyan/20',
    value: 'text-accent-cyan',
  },
  green: {
    icon: 'text-accent-green',
    glow: 'shadow-[0_0_15px_rgba(0,255,136,0.15)]',
    border: 'border-accent-green/20',
    value: 'text-accent-green',
  },
  orange: {
    icon: 'text-accent-orange',
    glow: 'shadow-[0_0_15px_rgba(255,140,0,0.15)]',
    border: 'border-accent-orange/20',
    value: 'text-accent-orange',
  },
  purple: {
    icon: 'text-accent-purple',
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
    border: 'border-accent-purple/20',
    value: 'text-accent-purple',
  },
  yellow: {
    icon: 'text-yellow-400',
    glow: 'shadow-[0_0_15px_rgba(255,217,61,0.15)]',
    border: 'border-yellow-400/20',
    value: 'text-yellow-400',
  },
};

export function StatCard({ title, value, icon, color, onClick }: StatCardProps) {
  const c = colorMap[color];
  const clickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`card-glass relative overflow-hidden flex items-center gap-4 p-4 rounded-xl transition-all duration-300 hover:scale-[1.02] ${c.glow} ${clickable ? 'cursor-pointer hover:border-accent-cyan/30' : ''}`}
    >
      {/* 背景装饰图标 - 半透明大字号 */}
      <i
        className={`fas ${icon} absolute -right-2 -bottom-2 text-6xl opacity-[0.06] ${c.icon}`}
        aria-hidden="true"
      />
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary ${c.icon}`}
      >
        <i className={`fas ${icon} text-xl`} />
      </div>
      <div className="flex flex-col">
        <span className={`text-2xl font-bold font-display ${c.value}`}>
          {value}
        </span>
        <span className="text-xs text-text-muted">{title}</span>
      </div>
    </div>
  );
}
