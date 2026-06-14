import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusTag } from '@/components/shared/StatusTag';
import { AiSummaryBox } from '@/components/shared/AiSummaryBox';
import { api } from '@/services/api';
import { getWeekLabel, getWeekStart, getWeekEnd, getAvailableWeeks, getWeekColor, getWeekBorderColor } from '@/utils/weekUtils';
import type { Progress, Project } from '@/types';

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

/** 获取当前周标签 */
function getCurrentWeekLabel(): string {
  return getWeekLabel(getTodayStr());
}

/** 根据周标签获取该周的日期范围（周四到周三） */
function getWeekDatesFromLabel(weekLabel: string): string[] {
  // weekLabel 格式: wkXX
  const match = weekLabel.match(/wk(\d{2})/i);
  if (!match) return [];

  const weekNum = parseInt(match[1], 10);
  const year = new Date().getFullYear();

  // 找到该年的第一个周四
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  const diffToThursday = (4 - jan1Day + 7) % 7;
  let firstThursday = new Date(year, 0, 1 + diffToThursday);
  if (firstThursday.getFullYear() !== year) {
    firstThursday = new Date(year, 0, 1 + diffToThursday + 7);
  }

  // 计算目标周的周四
  const targetThursday = new Date(firstThursday);
  targetThursday.setDate(targetThursday.getDate() + (weekNum - 1) * 7);

  // 生成周四到周三的7天
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(targetThursday);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
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
              本周
            </span>
          )}
        </div>
      </button>
      {expanded && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

/** 子项目折叠组件 - 用于"其它周"中按主项目->子项目层级展示 */
function SubProjectCollapsible({
  mainProjectName,
  subProjects,
  weekColor,
  weekBorderColor,
}: {
  mainProjectName: string;
  subProjects: {
    projectId: string;
    projectPath: string;
    owner: string;
    entries: Progress[];
    earliestPercent: number;
    latestPercent: number;
    delta: number;
  }[];
  weekColor: string;
  weekBorderColor: string;
}) {
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: weekBorderColor,
        backgroundColor: weekColor,
      }}
    >
      {/* 主项目标题 */}
      <div className="px-3 py-2 flex items-center gap-2">
        <i className="fas fa-folder text-xs text-accent-cyan" />
        <span className="text-xs font-bold text-text-primary">{mainProjectName}</span>
        <span className="text-[10px] text-text-muted">
          {subProjects.length} 个子项目
        </span>
      </div>

      {/* 子项目列表 */}
      <div className="px-2 pb-2 space-y-1">
        {subProjects.map(sp => {
          const isExpanded = expandedSubId === sp.projectId;

          return (
            <div
              key={sp.projectId}
              className="rounded-md border border-border-primary/10 bg-bg-primary/60 overflow-hidden"
            >
              {/* 子项目头部（可点击展开/折叠） */}
              <button
                onClick={() => setExpandedSubId(isExpanded ? null : sp.projectId)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-left transition-all hover:bg-bg-tertiary/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <i
                    className={`fas fa-chevron-right text-[10px] text-text-muted transition-transform duration-200 ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                  <span className="text-xs font-medium text-text-primary truncate">{sp.projectPath}</span>
                  {sp.owner && (
                    <span className="text-[10px] text-text-muted flex-shrink-0">
                      <i className="fas fa-user mr-0.5" />{sp.owner}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <span className="text-[10px] text-text-muted">{sp.earliestPercent}%</span>
                  <i className="fas fa-arrow-right text-[8px] text-text-muted" />
                  <span className="text-xs font-bold text-text-primary">{sp.latestPercent}%</span>
                  <span className={`text-[10px] font-bold ${sp.delta > 0 ? 'text-accent-green' : sp.delta < 0 ? 'text-accent-red' : 'text-text-muted'}`}>
                    {sp.delta > 0 ? '+' : ''}{sp.delta}%
                  </span>
                </div>
              </button>

              {/* 展开后显示该子项目在该周内的日别进度动作 */}
              {isExpanded && (
                <div className="px-2 pb-2 pt-0.5 space-y-1">
                  <ProgressBar percent={sp.latestPercent} size="sm" />
                  {sp.entries.map(entry => {
                    const entryDate = new Date(entry.date + 'T00:00:00');
                    const dayName = DAY_NAMES[entryDate.getDay()];
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-bg-tertiary/20"
                      >
                        <span className="text-text-muted min-w-[60px]">{entry.date.slice(5)}</span>
                        <span className="text-[10px] text-accent-cyan bg-accent-cyan/10 rounded px-1 py-0.5 flex-shrink-0">
                          {dayName}
                        </span>
                        <span className="text-accent-cyan font-bold min-w-[36px] text-right flex-shrink-0">{entry.percent}%</span>
                        <StatusTag
                          status={getStatusFromPercent(entry.percent)}
                          label={getStatusLabel(entry.percent)}
                        />
                        <span className="text-text-secondary truncate flex-1">{entry.content}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeeklyReportPage() {
  const [weekLabel, setWeekLabel] = useState(getCurrentWeekLabel());
  const [aiStyle, setAiStyle] = useState('');
  const { projects } = useProjectStore();
  const { entries, loadProgress } = useProgressStore();

  useEffect(() => {
    loadProgress();
    api.getSetting('ai_style').then(res => {
      if (res.success && res.data) setAiStyle(res.data.value || '');
    });
  }, [loadProgress]);

  // 获取所有可用周
  const availableWeeks = useMemo(() => getAvailableWeeks(entries.map(e => e.date)), [entries]);

  // 当前选中周的日期范围
  const weekDates = useMemo(() => getWeekDatesFromLabel(weekLabel), [weekLabel]);

  const weekEntries = useMemo(
    () => entries.filter(e => weekDates.includes(e.date)),
    [entries, weekDates]
  );

  // 按日期分组
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

  // 项目进度汇总
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

  // 本周所有负责人进度
  const ownerProgress = useMemo(() => {
    const ownerMap = new Map<string, Progress[]>();
    weekEntries.forEach(e => {
      const proj = projects.find(p => p.id === e.projectId);
      const owner = proj?.owner ?? '未知';
      if (!ownerMap.has(owner)) ownerMap.set(owner, []);
      ownerMap.get(owner)!.push(e);
    });

    return [...ownerMap.entries()].map(([owner, ownerEntries]) => {
      const completed = ownerEntries.filter(e => e.percent >= 100).length;
      const inProgress = ownerEntries.filter(e => e.percent < 100).length;
      const avgProgress = ownerEntries.reduce((s, e) => s + e.percent, 0) / ownerEntries.length;
      const projectIds = new Set(ownerEntries.map(e => e.projectId)).size;

      return { owner, entries: ownerEntries, completed, inProgress, avgProgress, projectCount: projectIds };
    });
  }, [weekEntries, projects]);

  const handlePrint = () => {
    window.print();
  };

  const currentWeekLabel = getCurrentWeekLabel();

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-display font-bold text-text-primary">
          <i className="fas fa-chart-bar mr-2 text-accent-cyan" />
          周报
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={weekLabel}
            onChange={e => setWeekLabel(e.target.value)}
            className="rounded-lg border border-border-primary/30 bg-bg-secondary px-3 py-1.5 text-xs text-text-primary w-28 focus:outline-none focus:ring-1 focus:ring-accent-cyan/50"
          >
            {availableWeeks.map(wk => (
              <option key={wk} value={wk}>{wk}</option>
            ))}
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

      {/* Week range display */}
      <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-3 text-center">
        <span className="text-xs text-text-muted">
          {weekDates[0] || '--'} ~ {weekDates[6] || '--'}
        </span>
        <span className="text-xs text-text-muted ml-3">
          共 {weekEntries.length} 条记录
        </span>
      </div>

      {/* AI Summary - 本周默认展开 */}
      <AiSummaryBox
        type="weekly"
        entries={weekEntries}
        projects={projects}
        defaultVisible={weekLabel === currentWeekLabel}
        style={aiStyle}
      />

      {/* 本周所有负责人进度 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">
          <i className="fas fa-users mr-1 text-accent-cyan" />
          本周负责人进度
        </h3>
        {ownerProgress.map(op => (
          <div
            key={op.owner}
            className="rounded-lg border border-border-primary/20 bg-bg-secondary p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary">{op.owner}</span>
                <span className="text-[10px] text-text-muted">
                  {op.projectCount} 个项目 | {op.entries.length} 条记录
                </span>
              </div>
              <div className="flex items-center gap-2">
                {op.completed > 0 && (
                  <span className="text-[10px] text-accent-green">
                    <i className="fas fa-check mr-0.5" />完成 {op.completed}
                  </span>
                )}
                {op.inProgress > 0 && (
                  <span className="text-[10px] text-accent-cyan">
                    <i className="fas fa-spinner mr-0.5" />进行中 {op.inProgress}
                  </span>
                )}
                <span className="text-xs font-bold text-accent-cyan">{op.avgProgress.toFixed(0)}%</span>
              </div>
            </div>
            {/* 负责人各项目进度列表 */}
            <div className="space-y-1.5">
              {(() => {
                const projMap = new Map<string, Progress[]>();
                op.entries.forEach(e => {
                  const list = projMap.get(e.projectId) ?? [];
                  list.push(e);
                  projMap.set(e.projectId, list);
                });
                return [...projMap.entries()].map(([projectId, projEntries]) => {
                  const sorted = [...projEntries].sort((a, b) => b.date.localeCompare(a.date));
                  const latest = sorted[0];
                  const path = getProjectPath(projectId, projects);
                  return (
                    <div key={projectId} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-bg-primary/50">
                      <span className="text-text-muted min-w-[120px] truncate">{path}</span>
                      <div className="flex-1 max-w-[120px]">
                        <ProgressBar percent={latest.percent} size="sm" />
                      </div>
                      <span className="text-accent-cyan font-bold min-w-[36px] text-right">{latest.percent}%</span>
                      <StatusTag
                        status={getStatusFromPercent(latest.percent)}
                        label={getStatusLabel(latest.percent)}
                      />
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        ))}

        {ownerProgress.length === 0 && (
          <div className="text-center py-4 text-text-muted text-sm">
            本周暂无负责人进度记录
          </div>
        )}
      </div>

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
          );
        })}
      </div>

      {/* 其它周的周报 - 折叠展示（按主项目->子项目层级，子项目下展开可看日别动作） */}
      {availableWeeks.filter(wk => wk !== weekLabel).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">
            <i className="fas fa-history mr-1 text-accent-cyan" />
            其它周
          </h3>
          {availableWeeks.filter(wk => wk !== weekLabel).map(wk => {
            const wkDates = getWeekDatesFromLabel(wk);
            const wkEntries = entries.filter(e => wkDates.includes(e.date));
            const wkProjectCount = new Set(wkEntries.map(e => e.projectId)).size;
            const wkAvg = wkEntries.length > 0
              ? wkEntries.reduce((s, e) => s + e.percent, 0) / wkEntries.length
              : 0;
            const isCurrent = wk === currentWeekLabel;

            // 按主项目分组，每个主项目下按子项目分组，每个子项目下按日期列出日别动作
            const mainProjectGroups = (() => {
              // 先按 projectId 分组
              const projMap = new Map<string, Progress[]>();
              wkEntries.forEach(e => {
                const list = projMap.get(e.projectId) ?? [];
                list.push(e);
                projMap.set(e.projectId, list);
              });

              // 再按主项目分组
              const mainMap = new Map<string, {
                mainProjectId: string;
                mainProjectName: string;
                subProjects: {
                  projectId: string;
                  projectPath: string;
                  owner: string;
                  entries: Progress[];
                  earliestPercent: number;
                  latestPercent: number;
                  delta: number;
                }[];
              }>();

              projMap.forEach((projEntries, projectId) => {
                const proj = projects.find(p => p.id === projectId);
                if (!proj) return;
                // 判断主项目：如果有 parentId 则为子项目，否则为主项目本身
                const mainProj = proj.parentId ? projects.find(p => p.id === proj.parentId) : proj;
                const mainId = mainProj?.id ?? projectId;
                const mainName = mainProj?.name ?? '未知项目';

                if (!mainMap.has(mainId)) {
                  mainMap.set(mainId, { mainProjectId: mainId, mainProjectName: mainName, subProjects: [] });
                }

                const sorted = [...projEntries].sort((a, b) => a.date.localeCompare(b.date));
                const earliest = sorted[0];
                const latest = sorted[sorted.length - 1];
                const delta = latest.percent - earliest.percent;

                mainMap.get(mainId)!.subProjects.push({
                  projectId,
                  projectPath: getProjectPath(projectId, projects),
                  owner: proj.owner ?? '',
                  entries: sorted,
                  earliestPercent: earliest.percent,
                  latestPercent: latest.percent,
                  delta,
                });
              });

              return [...mainMap.values()];
            })();

            return (
              <CollapsibleSection
                key={wk}
                title={wk}
                subtitle={`${wkDates[0] || '--'} ~ ${wkDates[6] || '--'} | ${wkEntries.length} 条 | ${wkProjectCount} 个项目 | 平均 ${wkAvg.toFixed(0)}%`}
                isCurrent={isCurrent}
              >
                {/* 该周的 AI 分析 */}
                <div className="mb-3">
                  <AiSummaryBox
                    type="weekly"
                    entries={wkEntries}
                    projects={projects}
                    defaultVisible={false}
                    style={aiStyle}
                  />
                </div>

                {/* 按主项目 -> 子项目层级展示，子项目下可展开查看日别动作 */}
                <div className="space-y-2">
                  {mainProjectGroups.map(mp => (
                    <SubProjectCollapsible
                      key={mp.mainProjectId}
                      mainProjectName={mp.mainProjectName}
                      subProjects={mp.subProjects}
                      weekColor={getWeekColor(wk)}
                      weekBorderColor={getWeekBorderColor(wk)}
                    />
                  ))}
                </div>
              </CollapsibleSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
