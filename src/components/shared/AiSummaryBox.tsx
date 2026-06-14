import { useEffect, useMemo, useState } from 'react';
import type { Progress, Project } from '@/types';
import { api } from '@/services/api';

interface AiSummaryBoxProps {
  type: 'daily' | 'weekly' | 'monthly';
  entries: Progress[];
  projects: Project[];
  /** 可选：外部控制是否展开 */
  defaultVisible?: boolean;
  style?: string;
}

/** 根据进度百分比获取状态文本 */
function getStatusByPercent(percent: number): string {
  if (percent >= 100) return '已完成';
  return '进行中';
}

/** 获取项目路径 */
function getProjectPath(projectId: string, projects: Project[]): string {
  const project = projects.find(p => p.id === projectId);
  if (!project) return '';
  if (!project.parentId) return project.name;
  const parent = projects.find(p => p.id === project.parentId);
  return parent ? `${parent.name}-${project.name}` : project.name;
}

/** 日报 AI 总结生成 */
function generateDailySummary(entries: Progress[], projects: Project[]): string {
  if (entries.length === 0) return '今日暂无进度记录。';

  // 统计总体完成情况
  const totalProjects = new Set(entries.map(e => e.projectId)).size;
  const completedCount = entries.filter(e => e.percent >= 100).length;
  const avgPercent = entries.reduce((sum, e) => sum + e.percent, 0) / entries.length;

  // 获取日期
  const today = entries[0]?.date || '';
  const dateStr = today.slice(5); // MM-DD

  // 按负责人分组
  const ownerMap = new Map<string, Progress[]>();
  entries.forEach(e => {
    const proj = projects.find(p => p.id === e.projectId);
    const owner = proj?.owner ?? '未知';
    if (!ownerMap.has(owner)) ownerMap.set(owner, []);
    ownerMap.get(owner)!.push(e);
  });

  // 识别重点完成项目（当天进度>=100%的）
  const completedProjects = entries.filter(e => e.percent >= 100);
  // 识别重点跟进项目（有风险或延期的）
  const followProjects = entries.filter(e => e.status === 'danger' || e.status === 'warning');

  let summary = `${dateStr} 技改数字化项目累计完成${totalProjects}个，完成率 ${avgPercent.toFixed(0)}%；\n`;

  if (completedProjects.length > 0) {
    summary += `重点完成项目${completedProjects.length}个：\n`;
    completedProjects.forEach((e, i) => {
      const path = getProjectPath(e.projectId, projects);
      summary += `①${path}：${e.content}\n`;
    });
  }

  if (followProjects.length > 0) {
    summary += `重点跟进项目${followProjects.length}个：\n`;
    followProjects.forEach((e, i) => {
      const path = getProjectPath(e.projectId, projects);
      summary += `①${path}：${e.content}\n`;
    });
  }

  // 负责人进度汇总
  if (ownerMap.size > 1) {
    summary += '\n各负责人进度：\n';
    ownerMap.forEach((ownerEntries, owner) => {
      const ownerAvg = ownerEntries.reduce((s, e) => s + e.percent, 0) / ownerEntries.length;
      summary += `- ${owner}：更新${ownerEntries.length}条，平均进度${ownerAvg.toFixed(0)}%\n`;
    });
  }

  return summary.trim();
}

/** 周报 AI 总结生成 */
function generateWeeklySummary(entries: Progress[], projects: Project[]): string {
  if (entries.length === 0) return '本周暂无进度记录。';

  // 统计总体完成情况
  const totalProjects = new Set(entries.map(e => e.projectId)).size;
  const completedCount = entries.filter(e => e.percent >= 100).length;
  const avgPercent = entries.reduce((sum, e) => sum + e.percent, 0) / entries.length;

  // 获取周别信息
  const dates = entries.map(e => e.date).sort();
  const weekStart = dates[0]?.slice(5) || '';
  const weekEnd = dates[dates.length - 1]?.slice(5) || '';

  // 获取周标签
  const weekLabel = getWeekLabelFromEntries(entries);

  // 按负责人分组
  const ownerMap = new Map<string, Progress[]>();
  entries.forEach(e => {
    const proj = projects.find(p => p.id === e.projectId);
    const owner = proj?.owner ?? '未知';
    if (!ownerMap.has(owner)) ownerMap.set(owner, []);
    ownerMap.get(owner)!.push(e);
  });

  // 按项目分组，获取每个项目的最新进度
  const projectMap = new Map<string, Progress[]>();
  entries.forEach(e => {
    const list = projectMap.get(e.projectId) ?? [];
    list.push(e);
    projectMap.set(e.projectId, list);
  });

  // 找出本周有重要进展的项目（进度变化大的）
  const projectProgress: { path: string; delta: number; latest: Progress; entries: Progress[] }[] = [];
  projectMap.forEach((projEntries, projectId) => {
    const sorted = [...projEntries].sort((a, b) => a.date.localeCompare(b.date));
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    const delta = latest.percent - earliest.percent;
    const path = getProjectPath(projectId, projects);
    projectProgress.push({ path, delta, latest, entries: projEntries });
  });

  // 按进度变化排序，优先展示变化大的
  projectProgress.sort((a, b) => b.delta - a.delta);

  let summary = `各位领导中午好。本周数字化核心进展：截至 ${weekLabel}，累计完成数字化技改项${totalProjects}项，整体进度${avgPercent.toFixed(1)}%。\n`;

  // 列出各项目进展
  projectProgress.forEach((pp, i) => {
    const proj = projects.find(p => p.id === pp.latest.projectId);
    const owner = proj?.owner ?? '';
    const status = getStatusByPercent(pp.latest.percent);

    summary += `\n${i + 1}、${pp.path}（${status}）\n`;
    summary += `业务描述：${pp.latest.content}\n`;

    if (pp.delta > 0) {
      summary += `价值体现：本周进度提升${pp.delta}%，当前进度${pp.latest.percent}%`;
    } else if (pp.latest.percent >= 100) {
      summary += `价值体现：项目已完成`;
    } else {
      summary += `价值体现：当前进度${pp.latest.percent}%，持续推进中`;
    }

    if (owner) {
      summary += `，负责人：${owner}`;
    }
    summary += '。\n';
  });

  // 负责人汇总
  if (ownerMap.size > 0) {
    summary += '\n本周各负责人进度：\n';
    ownerMap.forEach((ownerEntries, owner) => {
      const completed = ownerEntries.filter(e => e.percent >= 100).length;
      const inProgress = ownerEntries.filter(e => e.percent < 100).length;
      summary += `- ${owner}：更新${ownerEntries.length}条`;
      if (completed > 0) summary += `，完成${completed}项`;
      if (inProgress > 0) summary += `，进行中${inProgress}项`;
      summary += '\n';
    });
  }

  summary += '\n请悉知 @相关人员';
  return summary.trim();
}

/** 月报 AI 总结生成 */
function generateMonthlySummary(entries: Progress[], projects: Project[]): string {
  if (entries.length === 0) return '本月暂无进度记录。';

  // 获取月份信息
  const dates = entries.map(e => e.date).sort();
  const monthStr = dates[0]?.slice(0, 7) || '';

  // 统计总体
  const totalProjects = new Set(entries.map(e => e.projectId)).size;
  const completedCount = entries.filter(e => e.percent >= 100).length;
  const avgPercent = entries.reduce((sum, e) => sum + e.percent, 0) / entries.length;

  // 按主项目分组
  const mainProjectMap = new Map<string, { mainName: string; entries: Progress[] }>();
  entries.forEach(e => {
    const proj = projects.find(p => p.id === e.projectId);
    if (!proj) return;
    const mainProj = proj.parentId ? projects.find(p => p.id === proj.parentId) : proj;
    const mainName = mainProj?.name ?? '未知项目';
    if (!mainProjectMap.has(mainName)) {
      mainProjectMap.set(mainName, { mainName, entries: [] });
    }
    mainProjectMap.get(mainName)!.entries.push(e);
  });

  // 按天分组统计
  const dailyMap = new Map<string, Progress[]>();
  entries.forEach(e => {
    const list = dailyMap.get(e.date) ?? [];
    list.push(e);
    dailyMap.set(e.date, list);
  });

  // 按周分组统计
  const weekMap = new Map<string, Progress[]>();
  entries.forEach(e => {
    const wn = getWeekLabelFromDate(e.date);
    const list = weekMap.get(wn) ?? [];
    list.push(e);
    weekMap.set(wn, list);
  });

  let summary = `${monthStr} 月度数字化技改项目综合总结\n`;
  summary += `本月累计更新${entries.length}条记录，涉及${totalProjects}个项目，整体完成率${avgPercent.toFixed(1)}%。\n\n`;

  // 按主项目总结
  summary += '【主项目进度总结】\n';
  mainProjectMap.forEach(({ mainName, entries: projEntries }) => {
    const subProjectIds = new Set(projEntries.map(e => e.projectId));
    const completedSubs = projEntries.filter(e => e.percent >= 100).length;
    const avgSub = projEntries.reduce((s, e) => s + e.percent, 0) / projEntries.length;

    summary += `\n${mainName}：\n`;
    summary += `  涉及子项目${subProjectIds.size}个，已完成${completedSubs}个，平均进度${avgSub.toFixed(0)}%\n`;

    // 列出各子项目情况
    const subMap = new Map<string, Progress[]>();
    projEntries.forEach(e => {
      const list = subMap.get(e.projectId) ?? [];
      list.push(e);
      subMap.set(e.projectId, list);
    });

    subMap.forEach((subs, projectId) => {
      const sorted = [...subs].sort((a, b) => b.date.localeCompare(a.date));
      const latest = sorted[0];
      const path = getProjectPath(projectId, projects);
      const status = getStatusByPercent(latest.percent);
      summary += `  - ${path}：${status}，进度${latest.percent}%，${latest.content}\n`;
    });
  });

  // 周度进展
  summary += '\n【周度进展概览】\n';
  const sortedWeeks = [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  sortedWeeks.forEach(([weekLabel, weekEntries]) => {
    const weekAvg = weekEntries.reduce((s, e) => s + e.percent, 0) / weekEntries.length;
    const weekCompleted = weekEntries.filter(e => e.percent >= 100).length;
    summary += `${weekLabel}：更新${weekEntries.length}条，完成${weekCompleted}项，平均进度${weekAvg.toFixed(0)}%\n`;
  });

  return summary.trim();
}

/** 从日期字符串获取周标签 */
function getWeekLabelFromDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const year = date.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  const diffToThursday = (4 - jan1Day + 7) % 7;
  let firstThursday = new Date(year, 0, 1 + diffToThursday);
  if (firstThursday.getFullYear() !== year) {
    firstThursday = new Date(year, 0, 1 + diffToThursday + 7);
  }
  const diffDays = Math.floor((date.getTime() - firstThursday.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 'WK--';
  const weekNum = Math.floor(diffDays / 7) + 1;
  return `WK${String(weekNum).padStart(2, '0')}`;
}

/** 从条目获取周标签 */
function getWeekLabelFromEntries(entries: Progress[]): string {
  if (entries.length === 0) return 'WK--';
  const dates = entries.map(e => e.date).sort();
  return getWeekLabelFromDate(dates[Math.floor(dates.length / 2)]);
}

export function AiSummaryBox({ type, entries, projects, defaultVisible = false, style }: AiSummaryBoxProps) {
  const [visible, setVisible] = useState(defaultVisible);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 本地兜底总结
  const localSummary = useMemo(() => {
    switch (type) {
      case 'daily': return generateDailySummary(entries, projects);
      case 'weekly': return generateWeeklySummary(entries, projects);
      case 'monthly': return generateMonthlySummary(entries, projects);
    }
  }, [type, entries, projects]);

  // 尝试调用后端 AI 接口，失败则回退到本地生成
  useEffect(() => {
    if (!visible || entries.length === 0) return;
    setLoading(true);
    api.generateAiSummary(type, entries, projects, style)
      .then((res) => {
        if (res.success && res.data?.summary) {
          setAiSummary(res.data.summary);
        } else {
          setAiSummary(localSummary);
        }
      })
      .catch(() => {
        setAiSummary(localSummary);
      })
      .finally(() => setLoading(false));
  }, [visible, type, entries, projects, localSummary]);

  const summaryText = aiSummary || localSummary;
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

          {/* 加载中 */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <i className="fas fa-spinner fa-spin" />
              <span>AI 正在分析中...</span>
            </div>
          )}

          {/* 格式化文本展示 */}
          {!loading && (
            <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
              {summaryText}
            </div>
          )}

          {entries.length === 0 && (
            <p className="text-xs text-text-muted">暂无分析结果</p>
          )}
        </div>
      )}
    </div>
  );
}
