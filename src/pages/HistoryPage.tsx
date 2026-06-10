import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { StatusTag } from '@/components/shared/StatusTag';
import { ProgressBar } from '@/components/shared/ProgressBar';
import type { Progress, Project } from '@/types';

/** 负责人颜色映射 - 用于醒目标识 */
const ownerColorMap: Record<string, { bg: string; text: string; border: string }> = {
  '唐宝': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  '周刚': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  '杨利莉': { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  '常超': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
};

/** 获取负责人样式 */
function getOwnerStyle(owner: string): { bg: string; text: string; border: string } {
  return ownerColorMap[owner] ?? { bg: 'bg-accent-cyan/15', text: 'text-accent-cyan', border: 'border-accent-cyan/30' };
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

export function HistoryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { projects } = useProjectStore();
  const { entries, loadProgress } = useProgressStore();

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Sort entries by date descending, then by createdAt descending
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.createdAt.localeCompare(a.createdAt);
    }),
    [entries]
  );

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-text-primary">
          <i className="fas fa-history mr-2 text-accent-cyan" />
          更新记录
        </h2>
        <span className="text-xs text-text-muted">
          共 {sortedEntries.length} 条记录
        </span>
      </div>

      {/* Entry list */}
      <div className="space-y-1.5">
        {sortedEntries.map(entry => {
          const project = projects.find(p => p.id === entry.projectId);
          const projectPath = getProjectPath(entry.projectId, projects);
          const isExpanded = expandedId === entry.id;
          const owner = project?.owner ?? '';
          const ownerStyle = getOwnerStyle(owner);

          return (
            <div
              key={entry.id}
              className="rounded-lg border border-border-primary/20 bg-bg-secondary overflow-hidden transition-all"
            >
              {/* Summary row */}
              <button
                onClick={() => toggleExpand(entry.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-tertiary/30 transition-colors"
              >
                {/* Date */}
                <span className="text-xs text-text-muted min-w-[80px] shrink-0">{entry.date}</span>

                {/* 负责人 - 醒目显示：加粗、加大字号、颜色标识 */}
                {owner && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold border shrink-0 ${ownerStyle.bg} ${ownerStyle.text} ${ownerStyle.border}`}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: ownerStyle.text.replace('text-', ''),
                      }}
                    />
                    {owner}
                  </span>
                )}

                {/* Project name */}
                <span className="text-xs font-medium text-text-primary min-w-[120px] truncate">
                  {projectPath}
                </span>

                {/* Content preview */}
                <span className="text-xs text-text-secondary truncate flex-1">
                  {entry.content}
                </span>

                {/* Percent */}
                <span className="text-xs font-bold text-accent-cyan min-w-[36px] text-right shrink-0">
                  {entry.percent}%
                </span>

                {/* Status */}
                <div className="shrink-0">
                  <StatusTag status={entry.status} />
                </div>

                {/* Expand indicator */}
                <i
                  className={`fas fa-chevron-down text-[10px] text-text-muted transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border-primary/10 space-y-2">
                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <ProgressBar percent={entry.percent} size="sm" />
                    </div>
                    <span className="text-xs font-bold text-text-primary">{entry.percent}%</span>
                  </div>

                  {/* Full content */}
                  <div className="text-xs text-text-secondary leading-relaxed bg-bg-tertiary/30 rounded px-2 py-1.5">
                    {entry.content}
                  </div>

                  {/* Plan */}
                  {entry.plan && entry.plan.trim() && (
                    <div className="text-xs text-text-muted bg-bg-tertiary/20 rounded px-2 py-1.5">
                      <i className="fas fa-calendar-check mr-1 text-accent-cyan" />
                      计划：{entry.plan}
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-[10px] text-text-muted">
                    {/* 负责人 - 醒目显示 */}
                    {project && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold border ${ownerStyle.bg} ${ownerStyle.text} ${ownerStyle.border}`}
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: ownerStyle.text.replace('text-', ''),
                          }}
                        />
                        {project.owner}
                      </span>
                    )}
                    <span>
                      <i className="fas fa-clock mr-0.5" />
                      更新于 {entry.updatedAt.slice(0, 16).replace('T', ' ')}
                    </span>
                    {entry.attachments && entry.attachments.length > 0 && (
                      <span>
                        <i className="fas fa-paperclip mr-0.5" />
                        {entry.attachments.length} 个附件
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sortedEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <i className="fas fa-inbox text-3xl mb-3 opacity-30" />
            <p className="text-sm">暂无更新记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
