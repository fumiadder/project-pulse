interface CircularProgressProps {
  /** 进度百分比 0-100 */
  percent: number;
  /** 圆环大小（px） */
  size?: number;
  /** 线条粗细 */
  strokeWidth?: number;
  /** 进度颜色 */
  color?: string;
  /** 轨道颜色 */
  trackColor?: string;
  /** 中心内容 */
  children?: React.ReactNode;
  /** 图标（显示在百分比上方） */
  icon?: string;
  /** 标签文字 */
  label?: string;
  /** 副标题 */
  subtext?: string;
}

export function CircularProgress({
  percent,
  size = 80,
  strokeWidth = 6,
  color = 'var(--accent-cyan, #00d4ff)',
  trackColor = 'rgba(255,255,255,0.08)',
  children,
  icon,
  label,
  subtext,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          style={{ display: 'block' }}
        >
          {/* 轨道 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          {/* 进度 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.6s ease-in-out',
            }}
          />
        </svg>
        {/* 中心内容 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children ?? (
            <>
              {icon && (
                <i
                  className={`fas ${icon} text-sm mb-0.5`}
                  style={{ color }}
                />
              )}
              <span
                className="text-base font-bold"
                style={{ color }}
              >
                {Math.round(clampedPercent)}%
              </span>
            </>
          )}
        </div>
      </div>
      {label && (
        <span className="text-[11px] font-medium text-text-secondary text-center">
          {label}
        </span>
      )}
      {subtext && (
        <span className="text-[10px] text-text-muted text-center">
          {subtext}
        </span>
      )}
    </div>
  );
}
