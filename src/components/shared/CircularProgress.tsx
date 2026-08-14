import { useState, useEffect } from 'react';

interface CircularProgressProps {
  /** 进度百分比 0-100 */
  percent: number;
  /** 圆环大小（px） */
  size?: number;
  /** 移动端圆环大小（px） */
  mobileSize?: number;
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
  mobileSize = 64,
  strokeWidth = 6,
  color = 'var(--accent-cyan, #00d4ff)',
  trackColor = 'rgba(255,255,255,0.08)',
  children,
  icon,
  label,
  subtext,
}: CircularProgressProps) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const actualSize = isMobile ? (mobileSize ?? Math.min(size, 64)) : size;
  const actualStrokeWidth = isMobile ? Math.max(4, strokeWidth - 2) : strokeWidth;

  const radius = (actualSize - actualStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: actualSize, height: actualSize }}>
        <svg
          width={actualSize}
          height={actualSize}
          className="transform -rotate-90"
          style={{ display: 'block' }}
        >
          {/* 轨道 */}
          <circle
            cx={actualSize / 2}
            cy={actualSize / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={actualStrokeWidth}
          />
          {/* 进度 */}
          <circle
            cx={actualSize / 2}
            cy={actualSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={actualStrokeWidth}
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
                  className={`fas ${icon} ${isMobile ? 'text-xs' : 'text-sm'} mb-0.5`}
                  style={{ color }}
                />
              )}
              <span
                className={`${isMobile ? 'text-sm' : 'text-base'} font-bold`}
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
