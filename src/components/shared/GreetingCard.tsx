import { useState, useEffect } from 'react';
import { useUserStore } from '@/stores/useUserStore';

/** 获取问候语 */
function getGreeting(hour: number): string {
  if (hour < 6) return '夜深了';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了';
}

/** 获取激励语 */
function getMotivation(hour: number): string {
  if (hour < 6) return '注意休息，身体是革命的本钱。';
  if (hour < 9) return '新的一天，从规划开始。';
  if (hour < 12) return '保持专注，高效产出。';
  if (hour < 14) return '午间小憩，下午继续。';
  if (hour < 18) return '复盘比赶工更重要，留点时间思考。';
  if (hour < 22) return '今天的任务完成了吗？';
  return '早点休息吧。';
}

/** 获取星期几 */
function getWeekday(date: Date): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[date.getDay()];
}

/** 获取第几周 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

interface GreetingCardProps {
  /** 额外内容（如今日统计） */
  children?: React.ReactNode;
}

export function GreetingCard({ children }: GreetingCardProps) {
  const { currentUser } = useUserStore();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = now.getHours();
  const greeting = getGreeting(hour);
  const motivation = getMotivation(hour);
  const userName = currentUser?.name || '工作管理台';

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${getWeekday(now)}`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border-primary/30 bg-gradient-to-br from-bg-tertiary via-bg-secondary to-bg-tertiary p-2.5 md:p-4">
      {/* 装饰光效 */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-accent-cyan/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-accent-purple/5 blur-3xl" />

      <div className="relative flex flex-col gap-2 md:gap-3">
        {/* 问候 + 激励语 */}
        <div>
          <h2 className="text-sm md:text-lg font-bold text-text-primary font-display">
            {greeting}，{userName}
          </h2>
          <p className="text-[11px] md:text-xs text-text-secondary mt-0.5 md:mt-1">{motivation}</p>
        </div>

        {/* 时钟 + 日期 */}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xl md:text-3xl font-bold text-text-primary font-mono tracking-tight tabular-nums">
              {timeStr}
            </div>
            <div className="text-[11px] md:text-xs text-text-secondary mt-0.5 md:mt-1">
              {dateStr}
              <span className="hidden md:inline"> · 第{getWeekNumber(now)}周</span>
            </div>
          </div>
          {children && <div className="shrink-0 flex-wrap gap-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}
