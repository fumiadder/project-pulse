interface StatusTagProps {
  status: 'normal' | 'warning' | 'danger' | 'info' | 'success' | 'default';
  label?: string;
}

const statusConfig: Record<
  StatusTagProps['status'],
  { bg: string; text: string; dot: string; defaultLabel: string }
> = {
  normal: {
    bg: 'bg-accent-green/10',
    text: 'text-accent-green',
    dot: 'bg-accent-green',
    defaultLabel: '正常',
  },
  success: {
    bg: 'bg-accent-green/10',
    text: 'text-accent-green',
    dot: 'bg-accent-green',
    defaultLabel: '已完成',
  },
  warning: {
    bg: 'bg-accent-orange/10',
    text: 'text-accent-orange',
    dot: 'bg-accent-orange',
    defaultLabel: '有风险',
  },
  danger: {
    bg: 'bg-accent-red/10',
    text: 'text-accent-red',
    dot: 'bg-accent-red',
    defaultLabel: '延期',
  },
  info: {
    bg: 'bg-accent-cyan/10',
    text: 'text-accent-cyan',
    dot: 'bg-accent-cyan',
    defaultLabel: '未开始',
  },
  default: {
    bg: 'bg-text-muted/10',
    text: 'text-text-muted',
    dot: 'bg-text-muted',
    defaultLabel: '已注销',
  },
};

export function StatusTag({ status, label }: StatusTagProps) {
  const cfg = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} status-pulse`} />
      {label ?? cfg.defaultLabel}
    </span>
  );
}
