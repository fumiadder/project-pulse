import { useMemo } from 'react';

interface WeeklyHeatmapProps {
  /** 待办列表，用于统计每日完成数 */
  todos: { completedAt: string | null; createdAt: string; status: string }[];
  /** 显示周数，默认 8 周 */
  weeks?: number;
}

/** 获取日期的 YYYY-MM-DD 格式 */
function getDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 获取指定日期的周一 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface DayCell {
  date: string;
  count: number;
  isToday: boolean;
  isFuture: boolean;
  weekday: number;
}

export function WeeklyHeatmap({ todos, weeks = 8 }: WeeklyHeatmapProps) {
  const { grid, totalCompleted, maxCount, activeDays } = useMemo(() => {
    const today = new Date();
    const todayStr = getDateStr(today);
    const monday = getMonday(today);

    // 统计每日完成数
    const completionMap = new Map<string, number>();
    todos.forEach((t) => {
      if (t.status === 'completed' && t.completedAt) {
        const dateStr = t.completedAt.slice(0, 10);
        completionMap.set(dateStr, (completionMap.get(dateStr) ?? 0) + 1);
      }
    });

    // 生成网格：weeks 周 × 7 天
    const cells: DayCell[][] = [];
    let totalCompleted = 0;
    let maxCount = 0;
    let activeDays = 0;

    for (let w = weeks - 1; w >= 0; w--) {
      const weekStart = new Date(monday);
      weekStart.setDate(weekStart.getDate() - w * 7);
      const weekCells: DayCell[] = [];

      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(weekStart);
        cellDate.setDate(cellDate.getDate() + d);
        const dateStr = getDateStr(cellDate);
        const count = completionMap.get(dateStr) ?? 0;
        const isFuture = cellDate > today;
        const isToday = dateStr === todayStr;

        if (count > 0 && !isFuture) {
          totalCompleted += count;
          activeDays++;
          if (count > maxCount) maxCount = count;
        }

        weekCells.push({
          date: dateStr,
          count,
          isToday,
          isFuture,
          weekday: d,
        });
      }
      cells.push(weekCells);
    }

    return { grid: cells, totalCompleted, maxCount, activeDays };
  }, [todos, weeks]);

  /** 根据完成数量获取颜色等级 */
  function getCellColor(cell: DayCell): string {
    if (cell.isFuture) return 'bg-bg-tertiary/30';
    if (cell.count === 0) return 'bg-bg-tertiary/50';
    const ratio = maxCount > 0 ? cell.count / maxCount : 0;
    if (ratio >= 0.75) return 'bg-accent-green';
    if (ratio >= 0.5) return 'bg-accent-green/70';
    if (ratio >= 0.25) return 'bg-accent-green/50';
    return 'bg-accent-green/30';
  }

  /** 获取月份标签 */
  const monthLabels = useMemo(() => {
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    grid.forEach((week, wi) => {
      const firstDay = new Date(week[0].date);
      const month = firstDay.getMonth();
      if (month !== lastMonth) {
        labels.push({ weekIndex: wi, label: `${month + 1}月` });
        lastMonth = month;
      }
    });
    return labels;
  }, [grid]);

  const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <div className="flex flex-col gap-1.5 md:gap-2">
      {/* 统计摘要 */}
      <div className="flex items-center gap-3 md:gap-4 text-[10px] md:text-[10px] text-text-muted flex-wrap">
        <span>
          <i className="fas fa-check-circle text-accent-green mr-1" />
          近 {weeks} 周完成 <span className="font-bold text-accent-green">{totalCompleted}</span> 项
        </span>
        <span>
          <i className="fas fa-calendar-check text-accent-cyan mr-1" />
          活跃 <span className="font-bold text-accent-cyan">{activeDays}</span> 天
        </span>
        {activeDays > 0 && (
          <span className="hidden sm:inline">
            <i className="fas fa-fire text-accent-orange mr-1" />
            日均 <span className="font-bold text-accent-orange">{(totalCompleted / activeDays).toFixed(1)}</span> 项
          </span>
        )}
      </div>

      {/* 热力图 */}
      <div className="flex gap-1 md:gap-1.5">
        {/* 星期标签 */}
        <div className="flex flex-col gap-1 md:gap-1 pt-3 md:pt-4">
          {weekdayLabels.map((d, i) => (
            <div
              key={i}
              className="flex h-3.5 w-3 md:h-3.5 md:w-3 items-center justify-center text-[8px] md:text-[8px] text-text-muted"
            >
              {i % 2 === 0 ? d : ''}
            </div>
          ))}
        </div>

        {/* 网格 */}
        <div className="flex-1 overflow-x-auto">
          {/* 月份标签 */}
          <div className="flex gap-0.5 md:gap-1 mb-0.5">
            {grid.map((_, wi) => {
              const label = monthLabels.find((m) => m.weekIndex === wi);
              return (
                <div
                  key={wi}
                  className="w-3 md:w-3.5 text-[7px] md:text-[8px] text-text-muted"
                  style={{ minWidth: '12px' }}
                >
                  {label?.label ?? ''}
                </div>
              );
            })}
          </div>

          {/* 日期格子 */}
          <div className="flex gap-1 md:gap-1">
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1 md:gap-1">
                {week.map((cell) => (
                  <div
                    key={cell.date}
                    className={`h-3.5 w-3.5 md:h-3.5 md:w-3.5 rounded-sm transition-all hover:ring-1 hover:ring-accent-cyan/50 ${getCellColor(cell)} ${
                      cell.isToday ? 'ring-1 ring-accent-cyan' : ''
                    }`}
                    title={`${cell.date}${cell.count > 0 ? ` · 完成 ${cell.count} 项` : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-end gap-1 md:gap-1.5 text-[7px] md:text-[8px] text-text-muted">
        <span>少</span>
        <div className="h-2.5 md:h-2.5 w-2.5 md:w-2.5 rounded-sm bg-bg-tertiary/50" />
        <div className="h-2.5 md:h-2.5 w-2.5 md:w-2.5 rounded-sm bg-accent-green/30" />
        <div className="h-2.5 md:h-2.5 w-2.5 md:w-2.5 rounded-sm bg-accent-green/50" />
        <div className="h-2.5 md:h-2.5 w-2.5 md:w-2.5 rounded-sm bg-accent-green/70" />
        <div className="h-2.5 md:h-2.5 w-2.5 md:w-2.5 rounded-sm bg-accent-green" />
        <span>多</span>
      </div>
    </div>
  );
}
