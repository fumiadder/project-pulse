import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { AiSummaryBox } from '@/components/shared/AiSummaryBox';
import type { Progress, Project } from '@/types';

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get the ISO week number for a date */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get the Monday of the week containing the given date */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get all dates in a week (Mon-Sun) */
function getWeekDates(monday: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

function getProjectPath(projectId: string, projects: Project[]): string {
  const project = projects.find(p => p.id === projectId);
  if (!project) return '';
  if (!project.parentId) return project.name;
  const parent = projects.find(p => p.id === project.parentId);
  return parent ? `${parent.name} > ${project.name}` : project.name;
}

function getDefaultWeekLabel(): string {
  const today = new Date();
  const wn = getWeekNumber(today);
  return `${today.getFullYear()}-W${String(wn).padStart(2, '0')}`;
}

export function WeeklyReportPage() {
  const [weekLabel, setWeekLabel] = useState(getDefaultWeekLabel());
  const { projects } = useProjectStore();
  const { entries, loadProgress } = useProgressStore();

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Parse week label to get Monday
  const weekDates = useMemo(() => {
    const match = weekLabel.match(/^(\d{4})-W(\d{1,2})$/);
    if (!match) {
      // Default to current week
      const monday = getMondayOfWeek(new Date());
      return getWeekDates(monday);
    }
    const year = parseInt(match[1], 10);
    const weekNum = parseInt(match[2], 10);
    // January 4th is always in week 1
    const jan4 = new Date(year, 0, 4);
    const monday = getMondayOfWeek(jan4);
    monday.setDate(monday.getDate() + (weekNum - 1) * 7);
    return getWeekDates(monday);
  }, [weekLabel]);

  const weekEntries = useMemo(
    () => entries.filter(e => weekDates.includes(e.date)),
    [entries, weekDates]
  );

  // Group entries by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, Progress[]>();
    weekDates.forEach(date => {
      const dayEntries = weekEntries.filter(e => e.date === date);
      if (dayEntries.length > 0) {
        map.set(date, dayEntries);
      }
    });
    return map;
  }, [weekEntries, weekDates]);

  // Project summary with delta
  const projectSummary = useMemo(() => {
    const projectEntriesMap = new Map<string, Progress[]>();
    weekEntries.forEach(e => {
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
  }, [weekEntries, projects]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-display font-bold text-text-primary">
          <i className="fas fa-chart-bar mr-2 text-accent-cyan" />
          周报
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={weekLabel}
            onChange={e => setWeekLabel(e.target.value)}
            placeholder="YYYY-WNN"
            className="rounded-lg border border-border-primary/30 bg-bg-secondary px-3 py-1.5 text-xs text-text-primary w-32 focus:outline-none focus:ring-1 focus:ring-accent-cyan/50"
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

      {/* Week range display */}
      <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-3 text-center">
        <span className="text-xs text-text-muted">
          {weekDates[0]} ~ {weekDates[6]}
        </span>
        <span className="text-xs text-text-muted ml-3">
          共 {weekEntries.length} 条记录
        </span>
      </div>

      {/* AI Summary */}
      <AiSummaryBox type="weekly" entries={weekEntries} projects={projects} />

      {/* Project progress summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">
          <i className="fas fa-tasks mr-1 text-accent-cyan" />
          项目进度汇总
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
            本周暂无进度记录
          </div>
        )}
      </div>

      {/* Daily details */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          <i className="fas fa-list-alt mr-1 text-accent-cyan" />
          每日明细
        </h3>
        {[...groupedByDate.entries()].map(([date, dayEntries]) => {
          const dayDate = new Date(date + 'T00:00:00');
          const dayName = DAY_NAMES[dayDate.getDay()];

          return (
            <div
              key={date}
              className="rounded-lg border border-border-primary/20 bg-bg-secondary overflow-hidden"
            >
              <div className="bg-bg-tertiary/50 px-3 py-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary">{date}</span>
                <span className="text-[10px] text-accent-cyan bg-accent-cyan/10 rounded px-1.5 py-0.5">
                  {dayName}
                </span>
                <span className="text-[10px] text-text-muted ml-auto">{dayEntries.length} 条</span>
              </div>
              <div className="p-2 space-y-1.5">
                {dayEntries.map(entry => {
                  const projectPath = getProjectPath(entry.projectId, projects);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-bg-tertiary/30"
                    >
                      <span className="text-text-muted min-w-[120px] truncate">{projectPath}</span>
                      <span className="text-accent-cyan font-bold min-w-[36px] text-right">{entry.percent}%</span>
                      <span className="text-text-secondary truncate flex-1">{entry.content}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
