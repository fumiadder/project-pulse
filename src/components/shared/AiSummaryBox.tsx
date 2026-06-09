import { useMemo, useState } from 'react';
import type { Progress, Project } from '@/types';

interface AiSummaryBoxProps {
  type: 'daily' | 'weekly' | 'monthly';
  entries: Progress[];
  projects: Project[];
}

interface SummaryResult {
  highlights: string[];
  concerns: string[];
  suggestions: string[];
}

function generateAISummary(
  type: 'daily' | 'weekly' | 'monthly',
  entries: Progress[],
  projects: Project[]
): SummaryResult {
  const highlights: string[] = [];
  const concerns: string[] = [];
  const suggestions: string[] = [];

  if (entries.length === 0) {
    suggestions.push(`${type === 'daily' ? '当日' : type === 'weekly' ? '本周' : '本月'}暂无进度记录，请及时更新。`);
    return { highlights, concerns, suggestions };
  }

  const avgProgress =
    entries.reduce((sum, e) => sum + e.percent, 0) / entries.length;

  // Highlight completed projects
  const completedEntries = entries.filter(e => e.percent >= 100);
  if (completedEntries.length > 0) {
    const names = completedEntries.map(e => {
      const proj = projects.find(p => p.id === e.projectId);
      return proj?.name ?? '未知项目';
    });
    highlights.push(`已完成项目 ${names.length} 个：${names.slice(0, 5).join('、')}${names.length > 5 ? ' 等' : ''}`);
  }

  // High progress entries
  const highProgress = entries.filter(e => e.percent >= 80 && e.percent < 100);
  if (highProgress.length > 0) {
    highlights.push(`有 ${highProgress.length} 个项目进度超过80%，进展良好`);
  }

  // Average progress highlight
  if (avgProgress >= 70) {
    highlights.push(`${type === 'daily' ? '当日' : type === 'weekly' ? '本周' : '本月'}平均进度 ${avgProgress.toFixed(1)}%，整体推进顺利`);
  }

  // Danger entries
  const dangerEntries = entries.filter(e => e.status === 'danger');
  if (dangerEntries.length > 0) {
    const names = dangerEntries.map(e => {
      const proj = projects.find(p => p.id === e.projectId);
      return proj?.name ?? '未知项目';
    });
    concerns.push(`延期项目 ${dangerEntries.length} 个：${names.slice(0, 5).join('、')}${names.length > 5 ? ' 等' : ''}`);
  }

  // Warning entries
  const warningEntries = entries.filter(e => e.status === 'warning');
  if (warningEntries.length > 0) {
    concerns.push(`有风险项目 ${warningEntries.length} 个，需要关注`);
  }

  // Low progress entries
  const lowProgress = entries.filter(e => e.percent < 30);
  if (lowProgress.length > 0) {
    concerns.push(`有 ${lowProgress.length} 个项目进度低于30%，推进较慢`);
  }

  // Average progress concern
  if (avgProgress < 40 && entries.length > 2) {
    concerns.push(`${type === 'daily' ? '当日' : type === 'weekly' ? '本周' : '本月'}平均进度仅 ${avgProgress.toFixed(1)}%，需加快进度`);
  }

  // Entries with plans
  const entriesWithPlan = entries.filter(e => e.plan && e.plan.trim().length > 0);
  if (entriesWithPlan.length > 0) {
    highlights.push(`${entriesWithPlan.length} 个项目已填写明日计划`);
  } else if (entries.length > 3) {
    suggestions.push('建议为各项目填写明日计划，便于跟踪');
  }

  // Suggestion based on entry count
  if (type === 'daily' && entries.length < 3) {
    suggestions.push('今日更新条目较少，请确认是否遗漏');
  }

  // Owner distribution
  const ownerMap = new Map<string, number>();
  entries.forEach(e => {
    const proj = projects.find(p => p.id === e.projectId);
    const owner = proj?.owner ?? '未知';
    ownerMap.set(owner, (ownerMap.get(owner) ?? 0) + 1);
  });
  if (ownerMap.size > 0) {
    const topOwner = [...ownerMap.entries()].sort((a, b) => b[1] - a[1])[0];
    highlights.push(`更新最多：${topOwner[0]}（${topOwner[1]} 条）`);
  }

  // Projects with no progress
  const activeProjects = projects.filter(p => p.status === '进行中');
  const projectIdsWithProgress = new Set(entries.map(e => e.projectId));
  const noProgress = activeProjects.filter(p => !projectIdsWithProgress.has(p.id));
  if (noProgress.length > 0) {
    suggestions.push(`${noProgress.length} 个进行中项目未更新：${noProgress.slice(0, 3).map(p => p.name).join('、')}${noProgress.length > 3 ? ' 等' : ''}`);
  }

  return { highlights, concerns, suggestions };
}

export function AiSummaryBox({ type, entries, projects }: AiSummaryBoxProps) {
  const [visible, setVisible] = useState(false);
  const summary = useMemo(
    () => generateAISummary(type, entries, projects),
    [type, entries, projects]
  );

  const typeLabel = type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '月报';

  return (
    <div className="mt-4">
      {!visible && (
        <button
          onClick={() => setVisible(true)}
          className="flex items-center gap-2 rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 px-4 py-2.5 text-sm font-medium text-accent-cyan transition-all hover:bg-accent-cyan/10 hover:border-accent-cyan/50"
        >
          <i className="fas fa-robot" />
          <span>显示 AI {typeLabel}分析</span>
        </button>
      )}

      {visible && (
        <div className="rounded-xl border border-accent-cyan/20 bg-gradient-to-br from-accent-cyan/5 to-accent-purple/5 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <i className="fas fa-robot text-accent-cyan" />
            <span className="text-sm font-semibold text-accent-cyan">AI {typeLabel}智能分析</span>
            <button
              onClick={() => setVisible(false)}
              className="ml-auto text-text-muted hover:text-text-primary transition-colors"
            >
              <i className="fas fa-times text-xs" />
            </button>
          </div>

          {summary.highlights.length > 0 && (
            <div className="space-y-1.5">
              {summary.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-accent-green mt-0.5 shrink-0">
                    <i className="fas fa-check-circle" />
                  </span>
                  <span className="text-text-secondary">{h}</span>
                </div>
              ))}
            </div>
          )}

          {summary.concerns.length > 0 && (
            <div className="space-y-1.5">
              {summary.concerns.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-accent-orange mt-0.5 shrink-0">
                    <i className="fas fa-exclamation-triangle" />
                  </span>
                  <span className="text-text-secondary">{c}</span>
                </div>
              ))}
            </div>
          )}

          {summary.suggestions.length > 0 && (
            <div className="space-y-1.5">
              {summary.suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-accent-cyan mt-0.5 shrink-0">
                    <i className="fas fa-lightbulb" />
                  </span>
                  <span className="text-text-secondary">{s}</span>
                </div>
              ))}
            </div>
          )}

          {summary.highlights.length === 0 && summary.concerns.length === 0 && summary.suggestions.length === 0 && (
            <p className="text-xs text-text-muted">暂无分析结果</p>
          )}
        </div>
      )}
    </div>
  );
}
