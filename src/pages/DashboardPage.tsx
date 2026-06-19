import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { useUserStore } from '@/stores/useUserStore';
import { StatCard } from '@/components/shared/StatCard';
import { ProgressEditorModal } from '@/components/modals/ProgressEditorModal';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusTag } from '@/components/shared/StatusTag';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { Project, Progress } from '@/types';
import {
  getWeekLabel,
  getTodayStr,
  getWeekColor,
  getWeekBorderColor,
  getAvailableWeeks,
  getAvailableDates,
} from '@/utils/weekUtils';

/** Map project status string to status tag type */
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

/** 根据状态获取卡片底色样式 */
function getStatusBgStyle(status: string, tagStatus: string): React.CSSProperties {
  // 优先使用 tagStatus（来自最新进度），其次使用项目 status
  const s = tagStatus || status;
  switch (s) {
    case 'danger':
      return { backgroundColor: 'rgba(255, 51, 102, 0.10)', borderColor: 'rgba(255, 51, 102, 0.25)' };
    case 'warning':
      return { backgroundColor: 'rgba(255, 140, 0, 0.10)', borderColor: 'rgba(255, 140, 0, 0.25)' };
    case 'normal':
      // 区分进行中和已完成
      if (status === '完成' || status === 'completed') {
        return { backgroundColor: 'rgba(0, 255, 136, 0.08)', borderColor: 'rgba(0, 255, 136, 0.20)' };
      }
      return { backgroundColor: 'rgba(255, 217, 61, 0.08)', borderColor: 'rgba(255, 217, 61, 0.20)' };
    default:
      return {};
  }
}

/** 获取状态的中文标签 */
function getStatusLabel(status: string, tagStatus: string): string {
  const s = tagStatus || status;
  switch (s) {
    case 'danger':
      return '延期';
    case 'warning':
      return '有风险';
    case 'normal':
      if (status === '完成' || status === 'completed') return '已完成';
      return '进行中';
    default:
      return status || '未知';
  }
}

/** 按数字前缀排序子项目名称 */
function sortSubProjectsByName(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const numA = parseFloat(a.name);
    const numB = parseFloat(b.name);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
}

export function DashboardPage() {
  const { projects, getParentProjects, getSubProjects, loadProjects } = useProjectStore();
  const { entries, getByDate, loadProgress, getLatestByProject } = useProgressStore();
  const { currentUser, users } = useUserStore();

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('__me__'); // 默认当前用户
  const [parentFilter, setParentFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // 主项目折叠状态
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  // 今日更新筛选模式
  const [todayFilterActive, setTodayFilterActive] = useState(false);
  // 图片预览
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);

  // Progress modal state
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [preProjectId, setPreProjectId] = useState<string | undefined>(undefined);
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);

  // 自动滚动引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const targetCardRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  // Load data on mount
  useEffect(() => {
    loadProjects();
    loadProgress();
  }, []);

  const todayStr = getTodayStr();

  // 获取所有可用的筛选选项
  const filterOptions = useMemo(() => {
    // 所有负责人
    const allOwners = Array.from(new Set(projects.map((p) => p.owner).filter(Boolean))).sort();
    // 所有主项目
    const allParents = getParentProjects();
    // 所有周别（基于进度条目日期）
    const allWeeks = getAvailableWeeks(entries.map((e) => e.date));
    // 所有日期
    const allDates = getAvailableDates(entries.map((e) => e.date));
    // 所有优先级
    const allPriorities = Array.from(new Set(projects.map((p) => p.priority).filter(Boolean))).sort();

    return { allOwners, allParents, allWeeks, allDates, allPriorities };
  }, [projects, entries]);

  // 计算统计数据
  const stats = useMemo(() => {
    const effectiveOwner = ownerFilter === '__me__' ? currentUser?.name : ownerFilter === 'all' ? null : ownerFilter;
    const myProjects = effectiveOwner
      ? projects.filter((p) => p.owner === effectiveOwner)
      : projects;

    const inProgress = myProjects.filter(
      (p) => p.status === '进行中' || p.status === 'in-progress'
    ).length;

    const completed = myProjects.filter((p) => {
      const latest = getLatestByProject(p.id);
      return (latest && latest.percent >= 100) || p.status === '完成' || p.status === 'completed';
    }).length;

    const todayEntries = getByDate(todayStr).length;

    return {
      total: myProjects.length,
      inProgress,
      completed,
      todayUpdates: todayEntries,
    };
  }, [projects, currentUser, entries, todayStr, ownerFilter]);

  // 分组主项目及其子项目，应用筛选
  const projectSections = useMemo(() => {
    const parents = getParentProjects();
    const effectiveOwner = ownerFilter === '__me__' ? currentUser?.name : ownerFilter === 'all' ? null : ownerFilter;

    return parents
      .filter((parent) => {
        // 主项目筛选
        if (parentFilter !== 'all' && parent.id !== parentFilter) return false;
        return true;
      })
      .map((parent) => {
        let subs = getSubProjects(parent.id);

        // 负责人筛选
        if (effectiveOwner) {
          subs = subs.filter((sub) => sub.owner === effectiveOwner);
        }

        // 优先级筛选
        if (priorityFilter !== 'all') {
          subs = subs.filter((sub) => sub.priority === priorityFilter);
        }

        // 状态筛选
        if (statusFilter !== 'all') {
          subs = subs.filter((sub) => {
            const latest = getLatestByProject(sub.id);
            const tag = latest?.status ?? mapStatusToTag(sub.status);
            return tag === statusFilter;
          });
        }

        // 周别筛选 - 不再过滤子项目，而是在渲染时过滤日别条目
        // （保留此处为空，实际过滤在子项目卡片内部的 allEntries 中处理）

        // 日期筛选 - 同上

        // 按数字前缀排序
        subs = sortSubProjectsByName(subs);

        if (subs.length === 0) return null;

        // 计算主项目进度
        const totalPercent = subs.reduce((sum, sub) => {
          const latest = getLatestByProject(sub.id);
          return sum + (latest?.percent ?? 0);
        }, 0);
        const avgPercent = subs.length > 0 ? Math.round(totalPercent / subs.length) : 0;

        return {
          parent,
          subProjects: subs,
          progress: avgPercent,
        };
      })
      .filter(Boolean) as { parent: Project; subProjects: Project[]; progress: number }[];
  }, [projects, currentUser, statusFilter, ownerFilter, parentFilter, weekFilter, dateFilter, priorityFilter, entries]);

  // 查找需要自动滚动到的目标卡片ID
  const scrollTargetSubId = useMemo(() => {
    // 优先找今天有进度的子项目
    for (const section of projectSections) {
      for (const sub of section.subProjects) {
        const todayEntry = entries.find(
          (e) => e.projectId === sub.id && e.date === todayStr
        );
        if (todayEntry) return sub.id;
      }
    }
    // 其次找第一个未完成的子项目
    for (const section of projectSections) {
      for (const sub of section.subProjects) {
        const latest = getLatestByProject(sub.id);
        if (!latest || latest.percent < 100) return sub.id;
      }
    }
    return null;
  }, [projectSections, entries, todayStr]);

  // 自动滚动到目标卡片（使用主项目滚动容器内滚动）
  useEffect(() => {
    if (hasScrolled.current || !scrollTargetSubId) return;
    // 等待 DOM 渲染完成
    const timer = setTimeout(() => {
      const el = document.getElementById(`sub-card-${scrollTargetSubId}`);
      const container = scrollContainerRef.current;
      if (el && container) {
        // 使用容器内滚动，而不是 scrollIntoView
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const offset = elRect.top - containerRect.top + container.scrollTop - container.clientHeight / 3;
        container.scrollTo({ top: offset, behavior: 'smooth' });
        hasScrolled.current = true;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [scrollTargetSubId]);

  // 切换主项目折叠状态
  const toggleCollapse = useCallback((parentId: string) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  // Open progress modal for a specific project
  const handleAddProgress = (projectId: string) => {
    setPreProjectId(projectId);
    setProgressModalOpen(true);
  };

  const handleEditProgress = (entryId: string) => {
    setEditingProgressId(entryId);
    setProgressModalOpen(true);
  };

  const handleCloseProgressModal = () => {
    setProgressModalOpen(false);
    setPreProjectId(undefined);
    setEditingProgressId(null);
  };

  // 清除所有筛选
  const clearAllFilters = () => {
    setStatusFilter('all');
    setOwnerFilter('__me__');
    setParentFilter('all');
    setWeekFilter('all');
    setDateFilter('all');
    setPriorityFilter('all');
  };

  const hasFilter = statusFilter !== 'all' || ownerFilter !== '__me__' ||
    parentFilter !== 'all' || weekFilter !== 'all' || dateFilter !== 'all' || priorityFilter !== 'all';

  // 筛选栏通用样式
  const filterBtnClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
      active
        ? 'bg-accent-cyan/15 text-accent-cyan shadow-[0_0_10px_rgba(0,212,255,0.15)]'
        : 'bg-bg-tertiary text-text-muted hover:bg-bg-tertiary/80 hover:text-text-secondary'
    }`;

  return (
    <div
      className="flex flex-col p-4 md:p-6 animate-fade-in-up"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'IMG' && !target.closest('[contenteditable]')) {
          e.stopPropagation();
          setPreviewImage({ src: (target as HTMLImageElement).src, name: (target as HTMLImageElement).alt || (target as HTMLImageElement).title || '图片' });
        }
      }}
    >
      {/* 主内容区域：统计卡片 + 筛选栏 + 主项目区块一起滚动 */}
      <div ref={scrollContainerRef} className="flex flex-col gap-6 overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 120px)', minHeight: '300px' }}>
        {/* 统计卡片行 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard title="项目总数" value={stats.total} icon="fa-th-large" color="cyan" />
          <StatCard title="进行中" value={stats.inProgress} icon="fa-spinner" color="yellow" />
          <StatCard title="已完成" value={stats.completed} icon="fa-check-circle" color="green" />
          <StatCard
            title="今日更新"
            value={stats.todayUpdates}
            icon="fa-clock"
            color="purple"
            onClick={() => {
              const next = !todayFilterActive;
              setTodayFilterActive(next);
              if (next) {
                setDateFilter(todayStr);
              } else {
                setDateFilter('all');
              }
            }}
          />
        </div>
        {/* 筛选栏 - 所有筛选项统一一行 */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-custom/50 bg-bg-tertiary/30 p-3">
        {/* 负责人 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted whitespace-nowrap">负责人:</span>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="rounded-lg border border-border-custom bg-bg-tertiary px-2 py-1 text-xs text-text-primary focus:border-accent-cyan/50 focus:outline-none"
          >
            <option value="__me__">{currentUser?.name ?? '我'}</option>
            <option value="all">所有</option>
            {filterOptions.allOwners.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-4 bg-border-custom/50" />

        {/* 状态 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">状态:</span>
          {[
            { value: 'all', label: '全部' },
            { value: 'normal', label: '进行中' },
            { value: 'warning', label: '有风险' },
            { value: 'danger', label: '延期' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={filterBtnClass(statusFilter === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border-custom/50" />

        {/* 主项目 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted whitespace-nowrap">主项目:</span>
          <select
            value={parentFilter}
            onChange={(e) => setParentFilter(e.target.value)}
            className="rounded-lg border border-border-custom bg-bg-tertiary px-2 py-1 text-xs text-text-primary focus:border-accent-cyan/50 focus:outline-none"
          >
            <option value="all">所有</option>
            {filterOptions.allParents.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-4 bg-border-custom/50" />

        {/* 周别 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">周别:</span>
          <select
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className="rounded-lg border border-border-custom bg-bg-tertiary px-2 py-1 text-xs text-text-primary focus:border-accent-cyan/50 focus:outline-none"
          >
            <option value="all">所有</option>
            {filterOptions.allWeeks.map((wk) => (
              <option key={wk} value={wk}>{wk}</option>
            ))}
          </select>
        </div>

        {/* 日期 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">日期:</span>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-border-custom bg-bg-tertiary px-2 py-1 text-xs text-text-primary focus:border-accent-cyan/50 focus:outline-none"
          >
            <option value="all">所有</option>
            {filterOptions.allDates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* 优先级 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">优先级:</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-border-custom bg-bg-tertiary px-2 py-1 text-xs text-text-primary focus:border-accent-cyan/50 focus:outline-none"
          >
            <option value="all">所有</option>
            {filterOptions.allPriorities.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* 清除筛选 */}
        {hasFilter && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 rounded-lg border border-accent-red/20 bg-accent-red/5 px-2 py-1 text-xs text-accent-red transition-all hover:bg-accent-red/10 hover:border-accent-red/30 ml-auto"
          >
            <i className="fas fa-times text-[10px]" />
            <span>清除</span>
          </button>
        )}
      </div>

        {projectSections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <i className="fas fa-inbox text-3xl text-text-muted/40 mb-3" />
            <p className="text-sm text-text-muted">暂无匹配的项目</p>
          </div>
        )}

        {projectSections.map((section) => {
          const isCollapsed = collapsedParents.has(section.parent.id);

          return (
            <div
              key={section.parent.id}
              className="flex flex-col gap-0 rounded-xl border border-border-custom/50"
            >
              {/* 主项目标题栏（含进度条） */}
              <div
                className="flex items-center gap-3 bg-bg-secondary/50 px-4 py-3 cursor-pointer select-none"
                style={{ borderLeft: `4px solid ${section.parent.color || '#00d4ff'}` }}
                onClick={() => toggleCollapse(section.parent.id)}
              >
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: section.parent.color || '#00d4ff' }}
                />
                <h2 className="text-lg font-display font-bold text-text-primary flex-1 pl-2 border-l-[3px]" style={{ borderLeftColor: section.parent.color || '#00d4ff' }}>
                  {section.parent.name}
                </h2>
                {/* 主项目进度条 - 加粗 */}
                <div className="flex items-center gap-2 min-w-[160px] max-w-[240px]">
                  <div className="flex-1 h-[4px] rounded-full bg-bg-primary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${section.progress}%`,
                        backgroundColor:
                          section.progress >= 80 ? '#00ff88' :
                          section.progress >= 50 ? '#00d4ff' : '#ff8c00',
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-text-secondary min-w-[36px] text-right">
                    {section.progress}%
                  </span>
                </div>
                <span className="rounded-full bg-accent-cyan/10 px-2 py-0.5 text-xs font-medium text-accent-cyan whitespace-nowrap">
                  {section.subProjects.length} 个子项目
                </span>
                {/* 折叠/展开图标 */}
                <i className={`fas ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} text-text-muted text-xs ml-1`} />
              </div>

              {/* 子项目卡片区域 */}
              {!isCollapsed && (
                <div className="flex gap-5 items-stretch overflow-x-auto p-4 scrollbar-thin">
                  {section.subProjects.map((sub) => {
                    const latest = getLatestByProject(sub.id);
                    const percent = latest?.percent ?? 0;
                    const tagStatus = latest?.status ?? mapStatusToTag(sub.status);
                    let allEntries = entries
                      .filter((e) => e.projectId === sub.id)
                      .sort((a, b) => b.date.localeCompare(a.date)); // 按日期倒序

                    // 周别筛选：只显示匹配周别的日别动作卡片
                    if (weekFilter !== 'all') {
                      allEntries = allEntries.filter((e) => getWeekLabel(e.date) === weekFilter);
                    }
                    // 日期筛选：只显示匹配日期的日别动作卡片
                    if (dateFilter !== 'all') {
                      allEntries = allEntries.filter((e) => e.date === dateFilter);
                    }

                    // 子项目卡片不使用底色
                    // const statusStyle = getStatusBgStyle(sub.status, tagStatus);
                    const statusLabel = getStatusLabel(sub.status, tagStatus);

                    // 是否为滚动目标
                    const isScrollTarget = sub.id === scrollTargetSubId;

                    return (
                      <div
                        key={sub.id}
                        id={`sub-card-${sub.id}`}
                        className={`flex min-w-[300px] max-w-[340px] flex-1 flex-col gap-3 p-4 rounded-xl border transition-all duration-300 hover:scale-[1.01] ${
                          isScrollTarget ? 'ring-2 ring-accent-cyan/60 shadow-[0_0_20px_rgba(0,212,255,0.2)]' : ''
                        }`}
                        style={{
                        }}
                      >
                        {/* 子项目名称 + 操作按钮 */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-text-primary leading-tight truncate">
                              {sub.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              {/* 状态标签 */}
                              <StatusTag status={tagStatus as 'normal' | 'warning' | 'danger' | 'info'} label={statusLabel} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleAddProgress(sub.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all"
                              title="添加进度"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 子项目进度条 - 加粗 */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-[4px] rounded-full bg-bg-primary overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${percent}%`,
                                backgroundColor: percent >= 80 ? '#00ff88' : percent >= 50 ? '#00d4ff' : '#ff8c00',
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-text-secondary min-w-[32px] text-right">
                            {percent}%
                          </span>
                        </div>

                        {/* 每日进度列表 - 按日期正序排列 */}
                        {allEntries.length > 0 && (
                          <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto border-t border-border-custom/50 pt-2 scrollbar-thin">
                            {allEntries.map((entry) => {
                              const isToday = entry.date === todayStr;
                              const entryWeek = getWeekLabel(entry.date);
                              // 日别进度卡片的周别底色
                              const entryWeekBg = getWeekColor(entryWeek);
                              const entryWeekBorder = getWeekBorderColor(entryWeek);
                              return (
                                <TooltipProvider key={entry.id} delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`flex flex-col gap-1 rounded-lg px-3 py-2 transition-all cursor-default ${
                                          isToday
                                            ? 'border-l-[3px] border-l-accent-cyan ring-1 ring-accent-cyan/20 shadow-[0_0_8px_rgba(0,212,255,0.15)]'
                                            : ''
                                        }`}
                                        style={{
                                          backgroundColor: isToday ? 'rgba(0, 212, 255, 0.10)' : entryWeekBg,
                                          borderLeft: isToday ? '3px solid rgba(0, 212, 255, 0.8)' : `3px solid ${entryWeekBorder}`,
                                        }}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium text-text-secondary">
                                            <i className="far fa-calendar mr-1" />
                                            {entry.date}
                                            {/* 周别标签 - 在日别进度记录上醒目显示 */}
                                            {entryWeek && (
                                              <span
                                                                                className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-bold"
                                                                                style={{
                                                                                  backgroundColor: entryWeekBorder,
                                                                                  color: '#f1f5f9',
                                                                                }}
                                                                              >
                                                                                {entryWeek}
                                                                              </span>
                                                                            )}
                                            {isToday && (
                                              <span className="ml-1.5 inline-flex items-center rounded-full bg-accent-cyan/20 px-2 py-0.5 text-[10px] font-bold text-accent-cyan shadow-[0_0_6px_rgba(0,212,255,0.3)]">
                                                今天
                                              </span>
                                            )}
                                          </span>
                                          {/* 编辑按钮 */}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleEditProgress(entry.id); }}
                                            className="text-text-muted/50 hover:text-accent-cyan transition-colors"
                                            title="编辑进度"
                                          >
                                            <i className="fas fa-pen text-[10px]" />
                                          </button>
                                        </div>
                                        <p
                                          className={`text-xs text-text-muted leading-relaxed ${isToday ? '' : 'line-clamp-2'}`}
                                          dangerouslySetInnerHTML={{ __html: entry.content || '暂无更新内容' }}
                                        />
                                        {sub.owner && (
                                          <span className="text-[10px] text-text-muted/60">
                                            <i className="far fa-user mr-1" />
                                            {sub.owner}
                                          </span>
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      align="start"
                                      className="max-w-xs bg-bg-secondary border border-border-custom p-3 text-text-primary whitespace-pre-wrap"
                                      onPointerDown={(e) => e.stopPropagation()}
                                    >
                                      <div
                                        className="text-xs leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: entry.content || '暂无更新内容' }}
                                      />
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>
                        )}

                        {!latest && (
                          <div className="border-t border-border-custom/50 pt-3">
                            <p className="text-xs text-text-muted/50">暂无进度记录</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 进度编辑弹窗 */}
      <ProgressEditorModal
        open={progressModalOpen}
        onClose={handleCloseProgressModal}
        progressId={editingProgressId}
        preProjectId={preProjectId}
        preDate={todayStr}
      />

      {/* 全局图片预览 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage.src}
              alt={previewImage.name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <p className="text-center text-sm text-white/70 mt-2">{previewImage.name}</p>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
            >
              <i className="fas fa-times text-sm" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
