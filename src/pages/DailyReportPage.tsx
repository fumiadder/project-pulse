import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusTag } from '@/components/shared/StatusTag';
import { AiSummaryBox } from '@/components/shared/AiSummaryBox';
import { api } from '@/services/api';
import type { Progress, Project } from '@/types';

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
  if (percent >= 100) return 'normal'; // 已完成
  return 'normal'; // 进行中（默认显示为正常/进行中）
}

/** 根据进度百分比获取状态文本 */
function getStatusLabel(percent: number): string {
  if (percent >= 100) return '已完成';
  return '进行中';
}

/** 获取所有有记录的日期列表（去重排序） */
function getAvailableDates(entries: Progress[]): string[] {
  const dateSet = new Set<string>();
  entries.forEach(e => {
    if (e.date) dateSet.add(e.date);
  });
  return Array.from(dateSet).sort().reverse(); // 最新的在前
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
      {/* 折叠头部 */}
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
              今天
            </span>
          )}
        </div>
      </button>

      {/* 折叠内容 */}
      {expanded && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

export function DailyReportPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [aiStyle, setAiStyle] = useState('');
  const { projects } = useProjectStore();
  const { entries, loadProgress } = useProgressStore();

  useEffect(() => {
    loadProgress();
    api.getSetting('ai_style').then(res => {
      if (res.success && res.data) setAiStyle(res.data.value || '');
    });
  }, [loadProgress]);

  // 获取所有有记录的日期
  const availableDates = useMemo(() => getAvailableDates(entries), [entries]);

  // 当前选中日期的条目
  const dayEntries = useMemo(
    () => entries.filter(e => e.date === selectedDate),
    [entries, selectedDate]
  );

  const avgProgress = useMemo(() => {
    if (dayEntries.length === 0) return 0;
    return dayEntries.reduce((sum, e) => sum + e.percent, 0) / dayEntries.length;
  }, [dayEntries]);

  // 按项目分组
  const groupedByProject = useMemo(() => {
    const map = new Map<string, Progress[]>();
    dayEntries.forEach(e => {
      const list = map.get(e.projectId) ?? [];
      list.push(e);
      map.set(e.projectId, list);
    });
    return map;
  }, [dayEntries]);

  const handlePrint = () => {
    window.print();
  };

  const todayStr = getTodayStr();

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-display font-bold text-text-primary">
          <i className="fas fa-file-alt mr-2 text-accent-cyan" />
          日报
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
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

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-3 text-center">
          <div className="text-2xl font-bold text-accent-cyan">{dayEntries.length}</div>
          <div className="text-xs text-text-muted mt-1">更新条目</div>
        </div>
        <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-3 text-center">
          <div className="text-2xl font-bold text-accent-green">{avgProgress.toFixed(1)}%</div>
          <div className="text-xs text-text-muted mt-1">平均进度</div>
        </div>
        <div className="rounded-lg border border-border-primary/20 bg-bg-secondary p-3 text-center">
          <div className="text-2xl font-bold text-accent-purple">{groupedByProject.size}</div>
          <div className="text-xs text-text-muted mt-1">涉及项目</div>
        </div>
      </div>

      {/* AI Summary - 当天默认展开 */}
      <AiSummaryBox
        type="daily"
        entries={dayEntries}
        projects={projects}
        defaultVisible={selectedDate === todayStr}
        style={aiStyle}
      />

      {/* 当天日报详情 - 始终展开 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          <i className="fas fa-list mr-1 text-accent-cyan" />
          {selectedDate} 日报详情
        </h3>

        {[...groupedByProject.entries()].map(([projectId, projectEntries]) => {
          const project = projects.find(p => p.id === projectId);
          const projectPath = getProjectPath(projectId, projects);

          return (
            <div
              key={projectId}
              className="rounded-lg border border-border-primary/20 bg-bg-secondary p-4 space-y-3"
            >
              {/* Project header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{projectPath}</span>
                  {project && (
                    <StatusTag
                      status={getStatusFromPercent(projectEntries[projectEntries.length - 1]?.percent ?? 0)}
                      label={getStatusLabel(projectEntries[projectEntries.length - 1]?.percent ?? 0)}
                    />
                  )}
                </div>
                {project && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-cyan/15 px-2 py-0.5 text-xs font-semibold text-accent-cyan">
                    <i className="fas fa-user text-[10px]" />
                    {project.owner}
                  </span>
                )}
              </div>

              {/* Entries */}
              {projectEntries.map(entry => (
                <div key={entry.id} className="space-y-2 pl-2 border-l-2 border-accent-cyan/20">
                  <div className="text-xs text-text-secondary leading-relaxed">
                    {entry.content}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 max-w-[200px]">
                      <ProgressBar percent={entry.percent} size="sm" />
                    </div>
                    <span className="text-xs font-medium text-text-primary">{entry.percent}%</span>
                    {/* 状态与进度强绑定 */}
                    <StatusTag
                      status={getStatusFromPercent(entry.percent)}
                      label={getStatusLabel(entry.percent)}
                    />
                  </div>
                  {/* 附件预览 */}
                  {entry.attachments && entry.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {entry.attachments.map(att => (
                        <div key={att.id} className="relative">
                          {att.isImage ? (
                            <img
                              src={att.data}
                              alt={att.name}
                              className="h-12 w-12 rounded-lg object-cover border border-border-primary/30 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => window.open(att.data, '_blank')}
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-primary/30 bg-bg-tertiary/50">
                              <i className="fas fa-file text-text-muted text-sm" />
                            </div>
                          )}
                          <p className="text-[10px] text-text-muted mt-0.5 truncate max-w-[48px]">
                            {att.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {entry.plan && entry.plan.trim() && (
                    <div className="mt-1 rounded bg-bg-tertiary/50 px-2 py-1.5 text-xs text-text-muted">
                      <i className="fas fa-calendar-check mr-1 text-accent-cyan" />
                      明日计划：{entry.plan}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {dayEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <i className="fas fa-inbox text-3xl mb-3 opacity-30" />
            <p className="text-sm">{selectedDate} 暂无进度记录</p>
          </div>
        )}
      </div>

      {/* 其它天的日报 - 折叠展示 */}
      {availableDates.filter(d => d !== selectedDate).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">
            <i className="fas fa-history mr-1 text-accent-cyan" />
            其它日期
          </h3>
          {availableDates.filter(d => d !== selectedDate).map(date => {
            const dateEntries = entries.filter(e => e.date === date);
            const dateAvg = dateEntries.length > 0
              ? dateEntries.reduce((s, e) => s + e.percent, 0) / dateEntries.length
              : 0;
            const dateProjects = new Set(dateEntries.map(e => e.projectId)).size;
            const isToday = date === todayStr;

            return (
              <CollapsibleSection
                key={date}
                title={date}
                subtitle={`${dateEntries.length} 条记录 | ${dateProjects} 个项目 | 平均进度 ${dateAvg.toFixed(0)}%`}
                isCurrent={isToday}
              >
                {/* 该日期的 AI 分析 */}
                <div className="mb-3">
                  <AiSummaryBox
                    type="daily"
                    entries={dateEntries}
                    projects={projects}
                    defaultVisible={false}
                    style={aiStyle}
                  />
                </div>

                {/* 该日期的项目分组详情 */}
                <div className="space-y-2">
                  {(() => {
                    const grouped = new Map<string, Progress[]>();
                    dateEntries.forEach(e => {
                      const list = grouped.get(e.projectId) ?? [];
                      list.push(e);
                      grouped.set(e.projectId, list);
                    });

                    return [...grouped.entries()].map(([projectId, projectEntries]) => {
                      const project = projects.find(p => p.id === projectId);
                      const projectPath = getProjectPath(projectId, projects);

                      return (
                        <div
                          key={projectId}
                          className="rounded-lg border border-border-primary/10 bg-bg-primary/50 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-text-primary">{projectPath}</span>
                              <StatusTag
                                status={getStatusFromPercent(projectEntries[projectEntries.length - 1]?.percent ?? 0)}
                                label={getStatusLabel(projectEntries[projectEntries.length - 1]?.percent ?? 0)}
                              />
                            </div>
                            {project && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent-cyan/15 px-2 py-0.5 text-[10px] font-semibold text-accent-cyan">
                                <i className="fas fa-user text-[9px]" />{project.owner}
                              </span>
                            )}
                          </div>
                          {projectEntries.map(entry => (
                            <div key={entry.id} className="space-y-1 pl-2 border-l-2 border-accent-cyan/10">
                              <div className="text-xs text-text-secondary leading-relaxed">{entry.content}</div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 max-w-[160px]">
                                  <ProgressBar percent={entry.percent} size="sm" />
                                </div>
                                <span className="text-xs text-text-primary">{entry.percent}%</span>
                                <StatusTag
                                  status={getStatusFromPercent(entry.percent)}
                                  label={getStatusLabel(entry.percent)}
                                />
                              </div>
                              {entry.attachments && entry.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {entry.attachments.map(att => (
                                    <div key={att.id}>
                                      {att.isImage ? (
                                        <img
                                          src={att.data}
                                          alt={att.name}
                                          className="h-10 w-10 rounded object-cover border border-border-primary/20 cursor-pointer"
                                          onClick={() => window.open(att.data, '_blank')}
                                        />
                                      ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded border border-border-primary/20 bg-bg-secondary">
                                          <i className="fas fa-file text-text-muted text-xs" />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </div>
              </CollapsibleSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
