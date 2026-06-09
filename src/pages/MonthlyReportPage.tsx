import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { AiSummaryBox } from '@/components/shared/AiSummaryBox';
import type { Progress, Project } from '@/types';

function getProjectPath(projectId: string, projects: Project[]): string {
  const project = projects.find(p => p.id === projectId);
  if (!project) return '';
  if (!project.parentId) return project.name;
  const parent = projects.find(p => p.id === project.parentId);
  return parent ? `${parent.name} > ${project.name}` : project.name;
}

function getDefaultMonthLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Get all dates in a month */
function getMonthDates(yearMonth: string): string[] {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

/** Get ISO week number for a date */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function MonthlyReportPage() {
  const [monthLabel, setMonthLabel] = useState(getDefaultMonthLabel());
  const { projects } = useProjectStore();
  const { entries, loadProgress } = useProgressStore();

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const monthDates = useMemo(() => getMonthDates(monthLabel), [monthLabel]);

  const monthEntries = useMemo(
    () => entries.filter(e => e.date.startsWith(monthLabel)),
    [entries, monthLabel]
  );

  // Project summary with delta
  const projectSummary = useMemo(() => {
    const projectEntriesMap = new Map<string, Progress[]>();
    monthEntries.forEach(e => {
      const list = projectEntriesMap.get(e.projectId) ?? [];
      list.push(e);
      projectEntriesMap.set(e.projectId, list);
    });

    return [...projectEntriesMap.entries()].map(([projectId, projEntries]) => {
      const sorted = [...projEntries].sort((a, b) => a.date.localeCompare(b.date));
      const earliest = sorted[0];
      const latest = sorted[sorted.length - 1];
      const delta = latest.percent - earliest.percent;
      const projectPath = getProjectPath(projectId, projects);
      const project = projects.find(p => p.id === projectId);

      return {
        projectId,
        projectPath,
        owner: project?.owner ?? '',
        earliestPercent: earliest.percent,
        latestPercent: latest.percent,
        delta,
        entryCount: projEntries.length,
      };
    }).sort((a, b) => b.delta - a.delta);
  }, [monthEntries, projects]);

  // Weekly breakdown
  const weeklyBreakdown = useMemo(() => {
    const weekMap = new Map<string, Progress[]>();
    monthEntries.forEach(e => {
      const d = new Date(e.date + 'T00:00:00');
      const wn = getWeekNumber(d);
      const weekKey = `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`;
      const list = weekMap.get(weekKey) ?? [];
      list.push(e);
      weekMap.set(weekKey, list);
    });

    return [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, weekEntries]) => {
        const avgProgress =
          weekEntries.reduce((sum, e) => sum + e.percent, 0) / weekEntries.length;
        return { weekKey, entries: weekEntries, avgProgress, count: weekEntries.length };
      });
  }, [monthEntries]);

  // Group entries by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, Progress[]>();
    monthEntries.forEach(e => {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [monthEntries]);

  const handlePrint = () => {
    window.print();
  };

  const [yearStr, monthStr] = monthLabel.split('-');
  const displayLabel = `${yearStr}年${parseInt(monthStr, 10)}月`;

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-display font-bold text-text-primary">
          <i className="fas fa-chart-line mr-2 text-accent-cyan" />
          月报
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={monthLabel}
            onChange={e => setMonthLabel(e.target.value)}
            className="rounded-lg border border-border-primary/30 bg-bg-secondary px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-cyan/50"
          />
          <button
            onClick={handlePrint}
            className="rounded-lg border border-border-primary/30 bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-tertiary"
          >
            <i className="fas fa-print mr-1" />
            打印
          </button>
        </div>
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-3 text-center">
          <div className="text-2xl font-bold text-accent-cyan">{monthEntries.length}</div>
          <div className="text-xs text-text-muted mt-1">总更新条目</div>
        </div>
        <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-3 text-center">
          <div className="text-2xl font-bold text-accent-green">{projectSummary.length}</div>
          <div className="text-xs text-text-muted mt-1">涉及项目</div>
        </div>
        <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-3 text-center">
          <div className="text-2xl font-bold text-accent-purple">{weeklyBreakdown.length}</div>
          <div className="text-xs text-text-muted mt-1">活跃周数</div>
        </div>
      </div>

      {/* AI Summary */}
      <AiSummaryBox type="monthly" entries={monthEntries} projects={projects} />

      {/* Project progress summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">
          <i className="fas fa-tasks mr-1 text-accent-cyan" />
          项目进度汇总 ({displayLabel})
        </h3>
        {projectSummary.map(ps => (
          <div
            key={ps.projectId}
            className="rounded-lg border border-border-primary/20 bg-bg-secondary p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary">{ps.projectPath}</span>
                {ps.owner && (
                  <span className="text-[10px] text-text-muted">
                    <i className="fas fa-user mr-0.5" />{ps.owner}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">{ps.earliestPercent}%</span>
                <i className="fas fa-arrow-right text-[10px] text-text-muted" />
                <span className="text-xs font-bold text-text-primary">{ps.latestPercent}%</span>
                <span
                  className={`text-xs font-bold ${
                    ps.delta > 0
                      ? 'text-accent-green'
                      : ps.delta < 0
                        ? 'text-accent-red'
                        : 'text-text-muted'
                  }`}
                >
                  {ps.delta > 0 ? '+' : ''}{ps.delta}%
                </span>
              </div>
            </div>
            <ProgressBar percent={ps.latestPercent} size="sm" />
          </div>
        ))}

        {projectSummary.length === 0 && (
          <div className="text-center py-6 text-text-muted text-sm">
            <i className="fas fa-inbox text-2xl mb-2 opacity-30 block" />
            本月暂无进度记录
          </div>
        )}
      </div>

      {/* Weekly breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          <i className="fas fa-calendar-week mr-1 text-accent-cyan" />
          周度分解
        </h3>
        {weeklyBreakdown.map(wb => (
          <div
            key={wb.weekKey}
            className="rounded-lg border border-border-primary/20 bg-bg-secondary overflow-hidden"
          >
            <div className="bg-bg-tertiary/50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">{wb.weekKey}</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-text-muted">{wb.count} 条</span>
                <span className="text-xs font-bold text-accent-cyan">{wb.avgProgress.toFixed(1)}%</span>
              </div>
            </div>
            <div className="p-2 space-y-1.5">
              {wb.entries.map(entry => {
                const projectPath = getProjectPath(entry.projectId, projects);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-bg-tertiary/30"
                  >
                    <span className="text-text-muted min-w-[60px]">{entry.date.slice(5)}</span>
                    <span className="text-text-muted min-w-[120px] truncate">{projectPath}</span>
                    <span className="text-accent-cyan font-bold min-w-[36px] text-right">{entry.percent}%</span>
                    <span className="text-text-secondary truncate flex-1">{entry.content}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
