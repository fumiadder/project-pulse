interface ProgressBarProps {
  percent: number;
  size?: 'sm' | 'md' | 'lg';
}

function getColor(percent: number): string {
  if (percent >= 80) return 'bg-accent-green';
  if (percent >= 50) return 'bg-accent-cyan';
  return 'bg-accent-orange';
}

function getTrackHeight(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'h-1.5';
    case 'lg':
      return 'h-3';
    default:
      return 'h-2';
  }
}

export function ProgressBar({ percent, size = 'md' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const color = getColor(clamped);

  return (
    <div className={`w-full rounded-full bg-bg-tertiary ${getTrackHeight(size)} overflow-hidden`}>
      <div
        className={`${color} ${getTrackHeight(size)} rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
