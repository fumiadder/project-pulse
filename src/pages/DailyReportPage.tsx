import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusTag } from '@/components/shared/StatusTag';
import { AiSummaryBox } from '@/components/shared/AiSummaryBox';
import type { Progress, Project } from '@/types';

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getProjectPath(projectId: string, projects: Project[]): string {
  const project = projects.find(p => p.id === projectId);
  if (!project) return '';
  if (!project.parentId) return project.name;
  const parent = projects.find(p => p.id === project.parentId);
  return parent ? `${parent.name} > ${project.name}` : project.name;
}

function mapStatusToTag(status: string): 'normal' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case '延期':
    case 'delayed':
      return 'danger';
    case '有风险':
    case 'at-risk':
      return 'warning';
    case '正常':
    case '进行中':
    case 'completed':
    case '完成':
      return 'normal';
    default:
      return 'info';
  }
}

export function DailyReportPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const { projects } = useProjectStore();
  const { entries, loadProgress } = useProgressStore();

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const dayEntries = useMemo(
    () => entries.filter(e => e.date === selectedDate),
    [entries, selectedDate]
  );

  const avgProgress = useMemo(() => {
    if (dayEntries.length === 0) return 0;
    return dayEntries.reduce((sum, e) => sum + e.percent, 0) / dayEntries.length;
  }, [dayEntries]);

  // Group entries by project
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

      {/* AI Summary */}
      <AiSummaryBox type="daily" entries={dayEntries} projects={projects} />

      {/* Project groups */}
      <div className="space-y-3">
        {[...groupedByProject.entries()].map(([projectId, projectEntries]) => {
          const project = projects.find(p => p.id === projectId);
          const projectPath = getProjectPath(projectId, projects);
          const projectStatus = project?.status ?? '';

          return (
            <div
              key={projectId}
              className="rounded-lg border border-border-primary/20 bg-bg-secondary p-4 space-y-3"
            >
              {/* Project header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{projectPath}</span>
                  {projectStatus && <StatusTag status={mapStatusToTag(projectStatus)} label={projectStatus} />}
                </div>
                {project && (
                  <span className="text-xs text-text-muted">
                    <i className="fas fa-user mr-1" />
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
                  </div>
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
    </div>
  );
}
