import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusTag } from '@/components/shared/StatusTag';
import { AiSummaryBox } from '@/components/shared/AiSummaryBox';
import { api } from '@/services/api';
import { getWeekLabel, getWeekStart, getWeekEnd, getAvailableWeeks, getWeekColor, getWeekBorderColor } from '@/utils/weekUtils';
import type { Progress, Project } from '@/types';

/** 获取项目路径 */
function getProjectPath(projectId: string, projects: Project[]): string {
  const project = projects.find(p => p.id === projectId);
  if (!project) return '';
  if (!project.parentId) return project.name;
  const parent = projects.find(p => p.id === project.parentId);
  return parent ? `${parent.name} > ${project.name}` : project.name;
}

/** 根据进度百分比获取状态标签 */
function getStatusFromPercent(percent: number): 'normal' | 'warning' | 'danger' | 'info' {
  if (percent >= 100) return 'normal';
  return 'normal';
}

/** 根据进度百分比获取状态文本 */
function getStatusLabel(percent: number): string {
  if (percent >= 100) return '已完成';
  return '进行中';
}

function getDefaultMonthLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 获取当前月份标签 */
function getCurrentMonthLabel(): string {
  return getDefaultMonthLabel();
}

/** 获取所有有记录的月份列表 */
function getAvailableMonths(entries: Progress[]): string[] {
  const monthSet = new Set<string>();
  entries.forEach(e => {
    if (e.date) monthSet.add(e.date.slice(0, 7));
  });
  return Array.from(monthSet).sort().reverse(); // 最新的在前
}

/** 获取某月所有日期 */
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

/** 折叠面板组件 */
function CollapsibleSection({
  title,
  subtitle,
  isCurrent,
  children,
  defaultExpanded = false,
}: {
  title: string;
  subtitle?: string;
  isCurrent?: boolean;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-lg border border-border-primary/20 bg-bg-secondary overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-all hover:bg-bg-tertiary/30"
      >
        <div className="flex items-center gap-2">
          <i
            className={`fas fa-chevron-right text-xs text-text-muted transition-transform duration-200 ${
              expanded ? 'rotate-90' : ''
            }`}
          />
          <span className="text-sm font-semibold text-text-primary">{title}</span>
          {subtitle && (
            <span className="text-xs text-text-muted">{subtitle}</span>
          )}
          {isCurrent && (
            <span className="text-[10px] bg-accent-cyan/10 text-accent-cyan rounded px-1.5 py-0.5">
              本月
            </span>
          )}
        </div>
      </button>
      {expanded && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

/** 月报中"其它月份"的周度折叠组件 - 展开后可查看该周的项目进度明细 */
function MonthWeekCollapsible({
  weekKey,
  weekStart,
  weekEnd,
  entries,
  avgProgress,
  count,
  projects,
}: {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  entries: Progress[];
  avgProgress: number;
  count: number;
  projects: Project[];
}) {
  const [expanded, setExpanded] = useState(false);

  // 按项目分组展示该周的进度
  const projectGroups = useMemo(() => {
    const projMap = new Map<string, Progress[]>();
    entries.forEach(e => {
      const list = projMap.get(e.projectId) ?? [];
      list.push(e);
      projMap.set(e.projectId, list);
    });

    return [...projMap.entries()].map(([projectId, projEntries]) => {
      const sorted = [...projEntries].sort((a, b) => a.date.localeCompare(b.date));
      const earliest = sorted[0];
      const latest = sorted[sorted.length - 1];
      const delta = latest.percent - earliest.percent;
      const path = getProjectPath(projectId, projects);
      const proj = projects.find(p => p.id === projectId);

      return {
        projectId,
        projectPath: path,
        owner: proj?.owner ?? '',
        entries: sorted,
        earliestPercent: earliest.percent,
        latestPercent: latest.percent,
        delta,
      };
    });
  }, [entries, projects]);

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: getWeekBorderColor(weekKey),
        backgroundColor: getWeekColor(weekKey),
      }}
    >
      {/* 周标题（可点击展开/折叠） */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left transition-all hover:bg-bg-tertiary/30"
      >
        <div className="flex items-center gap-2">
          <i
            className={`fas fa-chevron-right text-[10px] text-text-muted transition-transform duration-200 ${
              expanded ? 'rotate-90' : ''
            }`}
          />
          <span className="text-xs font-semibold text-text-primary">{weekKey}</span>
          <span className="text-[10px] text-text-muted">
            {weekStart} ~ {weekEnd}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">{count} 条</span>
          <span className="text-xs font-bold text-accent-cyan">{avgProgress.toFixed(1)}%</span>
        </div>
      </button>

      {/* 展开后显示该周的项目进度明细 */}
      {expanded && (
        <div className="px-2 pb-2 space-y-1.5">
          {projectGroups.map(pg => (
            <div
              key={pg.projectId}
              className="rounded-md border border-border-primary/10 bg-bg-primary/60 p-2"
            >
              {/* 项目汇总行 */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-text-primary truncate">{pg.projectPath}</span>
                  {pg.owner && (
                    <span className="text-[10px] text-text-muted flex-shrink-0">
                      <i className="fas fa-user mr-0.5" />{pg.owner}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <span className="text-[10px] text-text-muted">{pg.earliestPercent}%</span>
                  <i className="fas fa-arrow-right text-[8px] text-text-muted" />
                  <span className="text-xs font-bold text-text-primary">{pg.latestPercent}%</span>
                  <span className={`text-[10px] font-bold ${pg.delta > 0 ? 'text-accent-green' : pg.delta < 0 ? 'text-accent-red' : 'text-text-muted'}`}>
                    {pg.delta > 0 ? '+' : ''}{pg.delta}%
                  </span>
                </div>
              </div>
              <ProgressBar percent={pg.latestPercent} size="sm" />

              {/* 该项目在该周的日别明细 */}
              <div className="mt-1 space-y-0.5">
                {pg.entries.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 text-xs px-1.5 py-0.5 rounded hover:bg-bg-tertiary/20"
                  >
                    <span className="text-text-muted min-w-[60px]">{entry.date.slice(5)}</span>
                    <span className="text-accent-cyan font-bold min-w-[36px] text-right">{entry.percent}%</span>
                    <StatusTag
                      status={getStatusFromPercent(entry.percent)}
                      label={getStatusLabel(entry.percent)}
                    />
                    <span className="text-text-secondary truncate flex-1">{entry.content}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MonthlyReportPage() {
  const [monthLabel, setMonthLabel] = useState(getDefaultMonthLabel());
  const [aiStyle, setAiStyle] = useState('');
  const { projects } = useProjectStore();
  const { entries, loadProgress } = useProgressStore();

  useEffect(() => {
    loadProgress();
    api.getSetting('ai_style').then(res => {
      if (res.success && res.data?.value) {
        setAiStyle(res.data.value);
      }
    });
  }, [loadProgress]);

  // 获取所有可用月份
  const availableMonths = useMemo(() => getAvailableMonths(entries), [entries]);

  const monthDates = useMemo(() => getMonthDates(monthLabel), [monthLabel]);

  const monthEntries = useMemo(
    () => entries.filter(e => e.date.startsWith(monthLabel)),
    [entries, monthLabel]
  );

  // 项目进度汇总
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

  // 按主项目分组汇总
  const mainProjectSummary = useMemo(() => {
    const mainMap = new Map<string, { mainName: string; subProjects: { projectId: string; projectPath: string; owner: string; latestPercent: number; delta: number; entryCount: number }[] }>();

    projectSummary.forEach(ps => {
      const project = projects.find(p => p.id === ps.projectId);
      if (!project) return;
      const mainProj = project.parentId ? projects.find(p => p.id === project.parentId) : project;
      const mainName = mainProj?.name ?? '未知项目';

      if (!mainMap.has(mainName)) {
        mainMap.set(mainName, { mainName, subProjects: [] });
      }
      mainMap.get(mainName)!.subProjects.push({
        projectId: ps.projectId,
        projectPath: ps.projectPath,
        owner: ps.owner,
        latestPercent: ps.latestPercent,
        delta: ps.delta,
        entryCount: ps.entryCount,
      });
    });

    return [...mainMap.entries()].map(([mainName, data]) => {
      const avgProgress = data.subProjects.reduce((s, sp) => s + sp.latestPercent, 0) / data.subProjects.length;
      const completedCount = data.subProjects.filter(sp => sp.latestPercent >= 100).length;
      return {
        mainName,
        subProjects: data.subProjects,
        avgProgress,
        completedCount,
        totalSubs: data.subProjects.length,
      };
    });
  }, [projectSummary, projects]);

  // 周度分解
  const weeklyBreakdown = useMemo(() => {
    const weekMap = new Map<string, Progress[]>();
    monthEntries.forEach(e => {
      const wn = getWeekLabel(e.date);
      const list = weekMap.get(wn) ?? [];
      list.push(e);
      weekMap.set(wn, list);
    });

    return [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, weekEntries]) => {
        const avgProgress =
          weekEntries.reduce((sum, e) => sum + e.percent, 0) / weekEntries.length;
        return { weekKey, entries: weekEntries, avgProgress, count: weekEntries.length };
      });
  }, [monthEntries]);

  // 按日期分组
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
  const currentMonthLabel = getCurrentMonthLabel();

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-display font-bold text-text-primary">
          <i className="fas fa-chart-line mr-2 text-accent-cyan" />
          月报
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={monthLabel}
            onChange={e => setMonthLabel(e.target.value)}
            className="rounded-lg border border-border-primary/30 bg-bg-secondary px-3 py-1.5 text-xs text-text-primary w-32 focus:outline-none focus:ring-1 focus:ring-accent-cyan/50"
          >
            {availableMonths.map(m => {
              const [y, mo] = m.split('-');
              return (
                <option key={m} value={m}>{y}年{parseInt(mo, 10)}月</option>
              );
            })}
          </select>
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

      {/* AI Summary - 当月默认展开 */}
      <AiSummaryBox
        type="monthly"
        entries={monthEntries}
        projects={projects}
        defaultVisible={monthLabel === currentMonthLabel}
        style={aiStyle}
      />

      {/* 主项目综合总结 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          <i className="fas fa-sitemap mr-1 text-accent-cyan" />
          主项目综合总结 ({displayLabel})
        </h3>
        {mainProjectSummary.map(mp => (
          <div
            key={mp.mainName}
            className="rounded-lg border border-border-primary/20 bg-bg-secondary p-4 space-y-3"
          >
            {/* 主项目头部 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-primary">{mp.mainName}</span>
                <span className="text-[10px] text-text-muted">
                  {mp.totalSubs} 个子项目 | 已完成 {mp.completedCount} 个
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-accent-cyan">{mp.avgProgress.toFixed(0)}%</span>
              </div>
            </div>
            <ProgressBar percent={mp.avgProgress} size="sm" />

            {/* 子项目列表 */}
            <div className="space-y-2 pl-2">
              {mp.subProjects.map(sp => (
                <div
                  key={sp.projectId}
                  className="rounded-lg border border-border-primary/10 bg-bg-primary/50 p-2.5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary">{sp.projectPath}</span>
                      {sp.owner && (
                        <span className="text-[10px] text-text-muted">
                          <i className="fas fa-user mr-0.5" />{sp.owner}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusTag
                        status={getStatusFromPercent(sp.latestPercent)}
                        label={getStatusLabel(sp.latestPercent)}
                      />
                      <span className="text-xs font-bold text-text-primary">{sp.latestPercent}%</span>
                      <span className={`text-[10px] font-bold ${sp.delta > 0 ? 'text-accent-green' : sp.delta < 0 ? 'text-accent-red' : 'text-text-muted'}`}>
                        {sp.delta > 0 ? '+' : ''}{sp.delta}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar percent={sp.latestPercent} size="sm" />
                </div>
              ))}
            </div>
          </div>
        ))}

        {mainProjectSummary.length === 0 && (
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
                    <StatusTag
                      status={getStatusFromPercent(entry.percent)}
                      label={getStatusLabel(entry.percent)}
                    />
                    <span className="text-text-secondary truncate flex-1">{entry.content}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 其它月的月报 - 折叠展示（含周度分解） */}
      {availableMonths.filter(m => m !== monthLabel).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">
            <i className="fas fa-history mr-1 text-accent-cyan" />
            其它月份
          </h3>
          {availableMonths.filter(m => m !== monthLabel).map(m => {
            const mEntries = entries.filter(e => e.date.startsWith(m));
            const mProjectCount = new Set(mEntries.map(e => e.projectId)).size;
            const mAvg = mEntries.length > 0
              ? mEntries.reduce((s, e) => s + e.percent, 0) / mEntries.length
              : 0;
            const [y, mo] = m.split('-');
            const mDisplay = `${y}年${parseInt(mo, 10)}月`;
            const isCurrent = m === currentMonthLabel;

            // 该月的主项目汇总
            const mMainProjects = (() => {
              const projMap = new Map<string, Progress[]>();
              mEntries.forEach(e => {
                const list = projMap.get(e.projectId) ?? [];
                list.push(e);
                projMap.set(e.projectId, list);
              });

              const mainMap = new Map<string, { name: string; avgProgress: number; subCount: number; completedCount: number }>();
              projMap.forEach((projEntries, projectId) => {
                const proj = projects.find(p => p.id === projectId);
                if (!proj) return;
                const mainProj = proj.parentId ? projects.find(p => p.id === proj.parentId) : proj;
                const mainName = mainProj?.name ?? '未知项目';

                if (!mainMap.has(mainName)) {
                  mainMap.set(mainName, { name: mainName, avgProgress: 0, subCount: 0, completedCount: 0 });
                }
                const mp = mainMap.get(mainName)!;
                mp.subCount++;
                const sorted = [...projEntries].sort((a, b) => b.date.localeCompare(a.date));
                mp.avgProgress += sorted[0].percent;
                if (sorted[0].percent >= 100) mp.completedCount++;
              });

              return [...mainMap.values()].map(mp => ({
                ...mp,
                avgProgress: mp.subCount > 0 ? mp.avgProgress / mp.subCount : 0,
              }));
            })();

            // 该月的周度分解
            const mWeeklyBreakdown = (() => {
              const weekMap = new Map<string, Progress[]>();
              mEntries.forEach(e => {
                const wn = getWeekLabel(e.date);
                const list = weekMap.get(wn) ?? [];
                list.push(e);
                weekMap.set(wn, list);
              });

              return [...weekMap.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([weekKey, weekEntries]) => {
                  const avgProgress =
                    weekEntries.reduce((sum, e) => sum + e.percent, 0) / weekEntries.length;
                  // 获取该周的日期范围
                  const sampleDate = weekEntries[0]?.date;
                  const weekStart = sampleDate ? getWeekStart(sampleDate) : '--';
                  const weekEnd = sampleDate ? getWeekEnd(sampleDate) : '--';
                  return { weekKey, entries: weekEntries, avgProgress, count: weekEntries.length, weekStart, weekEnd };
                });
            })();

            return (
              <CollapsibleSection
                key={m}
                title={mDisplay}
                subtitle={`${mEntries.length} 条记录 | ${mProjectCount} 个项目 | 平均进度 ${mAvg.toFixed(0)}%`}
                isCurrent={isCurrent}
              >
                {/* 该月的 AI 分析 */}
                <div className="mb-3">
                  <AiSummaryBox
                    type="monthly"
                    entries={mEntries}
                    projects={projects}
                    defaultVisible={false}
                    style={aiStyle}
                  />
                </div>

                {/* 该月的主项目汇总 */}
                <div className="space-y-2 mb-3">
                  {mMainProjects.map(mp => (
                    <div
                      key={mp.name}
                      className="rounded-lg border border-border-primary/10 bg-bg-primary/50 p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">{mp.name}</span>
                          <span className="text-[10px] text-text-muted">
                            {mp.subCount} 个子项目 | 完成 {mp.completedCount} 个
                          </span>
                        </div>
                        <span className="text-xs font-bold text-accent-cyan">{mp.avgProgress.toFixed(0)}%</span>
                      </div>
                      <ProgressBar percent={mp.avgProgress} size="sm" />
                    </div>
                  ))}
                </div>

                {/* 该月的周度分解 */}
                {mWeeklyBreakdown.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1">
                      <i className="fas fa-calendar-week text-accent-cyan" />
                      周度分解
                    </h4>
                    {mWeeklyBreakdown.map(wb => (
                      <MonthWeekCollapsible
                        key={wb.weekKey}
                        weekKey={wb.weekKey}
                        weekStart={wb.weekStart}
                        weekEnd={wb.weekEnd}
                        entries={wb.entries}
                        avgProgress={wb.avgProgress}
                        count={wb.count}
                        projects={projects}
                      />
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
