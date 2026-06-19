import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { useUserStore } from '@/stores/useUserStore';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusTag } from '@/components/shared/StatusTag';
import { ProgressEditorModal } from '@/components/modals/ProgressEditorModal';
import { ProjectEditorModal } from '@/components/modals/ProjectEditorModal';
import type { Project, Progress } from '@/types';
import {
  getWeekLabel,
  getTodayStr,
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

/** Map status filter value to matching logic */
function matchesStatusFilter(
  project: Project,
  latestProgress: Progress | undefined,
  filter: string
): boolean {
  if (filter === 'all') return true;

  if (latestProgress) {
    const tag = latestProgress.status;
    if (filter === 'normal' && tag === 'normal') return true;
    if (filter === 'warning' && tag === 'warning') return true;
    if (filter === 'danger' && tag === 'danger') return true;
    if (filter === 'info' && tag === 'info') return true;
  }

  if (filter === 'danger' && (project.status === '延期' || project.status === 'delayed')) return true;
  if (filter === 'warning' && (project.status === '有风险' || project.status === 'at-risk')) return true;
  if (filter === 'normal' && (project.status === '正常' || project.status === '进行中' || project.status === '完成')) return true;
  if (filter === 'info' && (project.status === '未开始')) return true;

  return false;
}

/** Priority badge color mapping */
function getPriorityStyle(priority: string): string {
  switch (priority) {
    case 'high':
    case '高':
      return 'bg-accent-red/10 text-accent-red';
    case 'medium':
    case '中':
      return 'bg-accent-orange/10 text-accent-orange';
    case 'low':
    case '低':
      return 'bg-accent-cyan/10 text-accent-cyan';
    default:
      return 'bg-bg-tertiary text-text-muted';
  }
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'high':
    case '高':
      return '高';
    case 'medium':
    case '中':
      return '中';
    case 'low':
    case '低':
      return '低';
    default:
      return priority;
  }
}

/** Format date string for display */
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return dateStr.slice(0, 10);
}

/** 获取状态的中文标签 */
function getStatusDisplayLabel(status: string, tagStatus: string): string {
  const s = tagStatus || status;
  switch (s) {
    case 'danger':
      return '延期';
    case 'warning':
      return '有风险';
    case 'normal':
      if (status === '完成' || status === 'completed') return '已完成';
      return '进行中';
    case 'info':
      return '未开始';
    default:
      return status || '未知';
  }
}

/** 折叠动画容器 - 兼容性更好的 max-height 方案 */
function CollapsibleSection({
  isExpanded,
  children,
}: {
  isExpanded: boolean;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<string>('0px');

  useEffect(() => {
    if (!contentRef.current) return;
    if (isExpanded) {
      // 展开：先测量内容高度，设置为具体值触发动画，然后切换到 none
      const h = contentRef.current.scrollHeight;
      setMaxH(`${h}px`);
      const timer = setTimeout(() => setMaxH('none'), 300);
      return () => clearTimeout(timer);
    } else {
      // 折叠：先设为当前高度（从 none 切换），然后下一帧设为 0
      const h = contentRef.current.scrollHeight;
      setMaxH(`${h}px`);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setMaxH('0px');
        });
      });
    }
  }, [isExpanded]);

  return (
    <div
      ref={contentRef}
      className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      style={{ maxHeight: maxH }}
    >
      {children}
    </div>
  );
}

/** Collapsible project row with expandable progress entries */
function ProjectRow({
  project,
  latestProgress,
  recentEntries,
  isExpanded,
  onToggle,
  onEditProject,
  onDeleteProject,
  onEditProgress,
  onDeleteProgress,
  canEdit = false,
}: {
  project: Project;
  latestProgress: Progress | undefined;
  recentEntries: Progress[];
  isExpanded: boolean;
  onToggle: () => void;
  onEditProject: () => void;
  onDeleteProject: () => void;
  onEditProgress: (entryId: string) => void;
  onDeleteProgress: (entryId: string) => void;
  canEdit?: boolean;
}) {
  const percent = latestProgress?.percent ?? 0;
  const tagStatus = latestProgress?.status ?? mapStatusToTag(project.status);
  const statusLabel = getStatusDisplayLabel(project.status, tagStatus);

  return (
    <div className="flex flex-col">
      {/* Main Row */}
      <div className="flex w-full items-center gap-4 rounded-lg bg-bg-secondary/40 px-4 py-3 text-left transition-all duration-200 hover:bg-bg-secondary/80 hover:border-accent-cyan/10 border border-transparent">
        {/* Expand Icon */}
        <button
          onClick={onToggle}
          className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Color dot */}
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: project.color || '#00d4ff' }}
        />

        {/* Project Name */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-text-primary truncate block">
            {project.name || '未命名项目'}
          </span>
        </div>

        {/* Owner */}
        <span className="hidden md:inline text-xs text-text-muted w-16 text-center shrink-0">
          {project.owner}
        </span>

        {/* Priority Badge */}
        <span
          className={`hidden sm:inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityStyle(project.priority)}`}
        >
          {getPriorityLabel(project.priority)}
        </span>

        {/* Status Tag */}
        <div className="shrink-0">
          <StatusTag status={tagStatus} label={statusLabel} />
        </div>

        {/* Dates */}
        <span className="hidden xl:inline text-xs text-text-muted w-20 text-right shrink-0">
          {formatDate(project.startDate)}
        </span>
        <span className="hidden xl:inline text-xs text-text-muted w-20 text-right shrink-0">
          {formatDate(project.endDate)}
        </span>

        {/* Action Buttons - 仅负责人可见 */}
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEditProject(); }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all"
              title="编辑项目"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteProject(); }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
              title="删除项目"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded: Recent Progress Entries - 使用折叠动画 */}
      <CollapsibleSection isExpanded={isExpanded}>
        <div className="ml-8 mt-1 flex flex-col gap-2 border-l-2 border-border-custom pl-4 pb-2">
          {recentEntries.length === 0 && (
            <p className="py-3 text-xs text-text-muted/50">暂无进度记录</p>
          )}
          {recentEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg bg-bg-tertiary/50 px-4 py-3 transition-all duration-200 hover:bg-bg-tertiary/80 group"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-accent-cyan">{entry.date}</span>
                  <StatusTag status={entry.status} />
                </div>
                {/* 进度卡片编辑和删除按钮 - 仅负责人可见 */}
                {canEdit && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditProgress(entry.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all"
                      title="编辑进度"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => onDeleteProgress(entry.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
                      title="删除进度"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              {entry.content && (
                <p
                  className="text-xs text-text-secondary leading-relaxed mb-1"
                  dangerouslySetInnerHTML={{ __html: entry.content }}
                />
              )}
              {entry.plan && (
                <p className="text-xs text-text-muted leading-relaxed">
                  <span className="text-text-muted/60">计划: </span>
                  {entry.plan}
                </p>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

export function ProjectsPage() {
  const { projects, getParentProjects, getSubProjects, loadProjects, deleteProject, updateProject } = useProjectStore();
  const { entries, getByProject, loadProgress, getLatestByProject, updateEntry, deleteEntry } = useProgressStore();
  const { currentUser, users } = useUserStore();

  // 权限判断：当前用户是否是项目负责人
  const isOwner = (project: Project) => {
    if (!currentUser) return false;
    // 匹配用户名或用户ID
    if (project.owner === currentUser.name || project.owner === currentUser.id) return true;
    // owner 为空或无法识别时，如果项目是当前用户的，也允许操作
    if (!project.owner || project.owner === '1') {
      return project.userId === currentUser.id;
    }
    return false;
  };

  // 筛选状态（和控制台一样支持多维度筛选）
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [parentFilter, setParentFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Load data on mount
  useEffect(() => {
    loadProjects();
    loadProgress();
  }, []);

  // 初始化时将所有项目（主项目+子项目）设为展开状态
  useEffect(() => {
    if (projects.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set(projects.map((p) => p.id)));
    }
  }, [projects]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [parentForNew, setParentForNew] = useState<string | null>(null);

  // 进度编辑弹窗状态
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);

  // 获取所有可用的筛选选项
  const filterOptions = useMemo(() => {
    const allOwners = Array.from(new Set(projects.map((p) => p.owner).filter(Boolean))).sort();
    const allParents = getParentProjects();
    const allWeeks = getAvailableWeeks(entries.map((e) => e.date));
    const allDates = getAvailableDates(entries.map((e) => e.date));
    const allPriorities = Array.from(new Set(projects.map((p) => p.priority).filter(Boolean))).sort();
    return { allOwners, allParents, allWeeks, allDates, allPriorities };
  }, [projects, entries]);

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Open modal for creating a new parent project
  const handleCreateParent = () => {
    setEditingProjectId(null);
    setParentForNew(null);
    setModalOpen(true);
  };

  // Open modal for creating a sub-project
  const handleCreateSub = (parentId: string) => {
    setEditingProjectId(null);
    setParentForNew(parentId);
    setModalOpen(true);
  };

  // Open modal for editing a project
  const handleEdit = (projectId: string) => {
    setEditingProjectId(projectId);
    setParentForNew(null);
    setModalOpen(true);
  };

  // Delete a project
  const handleDelete = (project: Project) => {
    const subProjects = getSubProjects(project.id);
    const hasChildren = subProjects.length > 0;
    const warning = hasChildren
      ? `确定要删除项目「${project.name}」及其 ${subProjects.length} 个子项目吗？此操作不可撤销。`
      : `确定要删除项目「${project.name}」吗？此操作不可撤销。`;

    if (window.confirm(warning)) {
      if (hasChildren) {
        subProjects.forEach((sub) => deleteProject(sub.id));
      }
      deleteProject(project.id);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProjectId(null);
    setParentForNew(null);
  };

  // 编辑进度记录
  const handleEditProgress = (entryId: string) => {
    setEditingProgressId(entryId);
    setProgressModalOpen(true);
  };

  // 删除进度记录
  const handleDeleteProgress = async (entryId: string) => {
    if (!window.confirm('确定要删除这条进度记录吗？此操作不可撤销。')) return;
    await deleteEntry(entryId);
  };

  // 关闭进度编辑弹窗
  const handleCloseProgressModal = () => {
    setProgressModalOpen(false);
    setEditingProgressId(null);
  };

  // 清除所有筛选
  const clearAllFilters = () => {
    setSearchValue('');
    setStatusFilter('all');
    setOwnerFilter('all');
    setParentFilter('all');
    setWeekFilter('all');
    setDateFilter('all');
    setPriorityFilter('all');
  };

  const hasFilter = searchValue !== '' || statusFilter !== 'all' || ownerFilter !== 'all' ||
    parentFilter !== 'all' || weekFilter !== 'all' || dateFilter !== 'all' || priorityFilter !== 'all';

  // 筛选栏通用样式
  const filterBtnClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
      active
        ? 'bg-accent-cyan/15 text-accent-cyan shadow-[0_0_10px_rgba(0,212,255,0.15)]'
        : 'bg-bg-tertiary text-text-muted hover:bg-bg-tertiary/80 hover:text-text-secondary'
    }`;

  // Group by parent project with full filtering
  // 自然排序：按名称中的数字部分排序（如 1, 2, 10 而非 1, 10, 2）
  const naturalSort = (a: string, b: string) =>
    a.localeCompare(b, 'zh-CN', { numeric: true, sensitivity: 'base' });

  const projectGroups = useMemo(() => {
    const parents = getParentProjects();
    const effectiveOwner = ownerFilter === 'all' ? null : ownerFilter;

    return parents
      .filter((parent) => {
        // 主项目筛选
        if (parentFilter !== 'all' && parent.id !== parentFilter) return false;
        return true;
      })
      .sort((a, b) => naturalSort(a.name, b.name))
      .map((parent) => {
        let subs = getSubProjects(parent.id);

        // 负责人筛选
        if (effectiveOwner) {
          subs = subs.filter((sub) => sub.owner === effectiveOwner);
        }

        // 搜索筛选
        if (searchValue) {
          subs = subs.filter((sub) =>
            sub.name.toLowerCase().includes(searchValue.toLowerCase())
          );
        }

        // 优先级筛选
        if (priorityFilter !== 'all') {
          subs = subs.filter((sub) => sub.priority === priorityFilter);
        }

        // 状态筛选
        if (statusFilter !== 'all') {
          subs = subs.filter((sub) => {
            const latest = getLatestByProject(sub.id);
            return matchesStatusFilter(sub, latest, statusFilter);
          });
        }

        // 周别筛选 - 基于子项目是否有该周别的进度
        if (weekFilter !== 'all') {
          subs = subs.filter((sub) => {
            const subEntries = entries.filter((e) => e.projectId === sub.id);
            if (subEntries.length === 0) return false;
            return subEntries.some((e) => getWeekLabel(e.date) === weekFilter);
          });
        }

        // 日期筛选 - 基于子项目是否有该日期的进度
        if (dateFilter !== 'all') {
          subs = subs.filter((sub) => {
            const subEntries = entries.filter((e) => e.projectId === sub.id);
            return subEntries.some((e) => e.date === dateFilter);
          });
        }

        return {
          parent,
          subProjects: subs.sort((a, b) => naturalSort(a.name, b.name)),
        };
      })
      .filter((g): g is { parent: Project; subProjects: Project[] } => g !== null);
  }, [projects, currentUser, searchValue, statusFilter, ownerFilter, parentFilter, weekFilter, dateFilter, priorityFilter, entries]);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-cyan/10">
            <i className="fas fa-project-diagram text-accent-cyan text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-text-primary">项目管理</h1>
            <p className="text-xs text-text-muted">
              按大项目分组的层级视图
            </p>
          </div>
        </div>

        {/* New Parent Project Button */}
        <button
          onClick={handleCreateParent}
          className="flex items-center gap-1.5 rounded-lg bg-accent-cyan px-3 py-2 text-xs font-medium text-white transition-all hover:bg-accent-cyan/80 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          新建大项目
        </button>
      </div>

      {/* 筛选栏 - 和控制台一样的多维度筛选 */}
      <div className="flex flex-col gap-3 rounded-xl border border-border-custom/50 bg-bg-secondary/30 p-4">
        {/* 第一行：搜索 + 负责人 + 主项目 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="搜索项目名称..."
              className="w-full rounded-lg border border-border-custom bg-bg-tertiary pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/20"
            />
          </div>

          {/* 负责人筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted whitespace-nowrap">负责人:</span>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="rounded-lg border border-border-custom bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary focus:border-accent-cyan/50 focus:outline-none"
            >
              <option value="all">所有</option>
              {filterOptions.allOwners.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* 主项目筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted whitespace-nowrap">主项目:</span>
            <select
              value={parentFilter}
              onChange={(e) => setParentFilter(e.target.value)}
              className="rounded-lg border border-border-custom bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary focus:border-accent-cyan/50 focus:outline-none"
            >
              <option value="all">所有</option>
              {filterOptions.allParents.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 第二行：状态 + 周别 + 日期 + 优先级 + 清除 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 状态筛选 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted">状态:</span>
            {[
              { value: 'all', label: '全部' },
              { value: 'info', label: '未开始' },
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

          <div className="w-px h-4 bg-border-custom/50 mx-1" />

          {/* 周别筛选 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted">周别:</span>
            <select
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
              className="rounded-lg border border-border-custom bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary focus:border-accent-cyan/50 focus:outline-none"
            >
              <option value="all">所有</option>
              {filterOptions.allWeeks.map((wk) => (
                <option key={wk} value={wk}>{wk}</option>
              ))}
            </select>
          </div>

          {/* 日期筛选 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted">日期:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-border-custom bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary focus:border-accent-cyan/50 focus:outline-none"
            >
              <option value="all">所有</option>
              {filterOptions.allDates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* 优先级筛选 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-muted">优先级:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-border-custom bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary focus:border-accent-cyan/50 focus:outline-none"
            >
              <option value="all">所有</option>
              {filterOptions.allPriorities.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 一键展开/折叠 - 区分主项目和子项目 */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => {
                const parentIds = getParentProjects().map(p => p.id);
                setExpandedIds(prev => {
                  const next = new Set(prev);
                  // 如果所有主项目都已展开，则折叠所有主项目
                  const allParentsExpanded = parentIds.every(id => next.has(id));
                  if (allParentsExpanded) {
                    parentIds.forEach(id => next.delete(id));
                  } else {
                    parentIds.forEach(id => next.add(id));
                  }
                  return next;
                });
              }}
              className="flex items-center gap-1 rounded-lg border border-border-custom/50 bg-bg-tertiary px-2 py-1 text-xs text-text-muted transition-all hover:text-text-primary"
              title="展开/折叠主项目"
            >
              <i className="fas fa-folder text-[10px]" />
              <span>主项目</span>
            </button>
            <button
              onClick={() => {
                const subIds = projects.filter(p => p.parentId).map(p => p.id);
                setExpandedIds(prev => {
                  const next = new Set(prev);
                  const allSubsExpanded = subIds.every(id => next.has(id));
                  if (allSubsExpanded) {
                    subIds.forEach(id => next.delete(id));
                  } else {
                    subIds.forEach(id => next.add(id));
                  }
                  return next;
                });
              }}
              className="flex items-center gap-1 rounded-lg border border-border-custom/50 bg-bg-tertiary px-2 py-1 text-xs text-text-muted transition-all hover:text-text-primary"
              title="展开/折叠子项目"
            >
              <i className="fas fa-file-alt text-[10px]" />
              <span>子项目</span>
            </button>
          </div>

          {/* 清除筛选按钮 */}
          {hasFilter && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 rounded-lg border border-accent-red/20 bg-accent-red/5 px-2.5 py-1.5 text-xs text-accent-red transition-all duration-200 hover:bg-accent-red/10 hover:border-accent-red/30 animate-fade-in-up"
            >
              <i className="fas fa-times text-[10px]" />
              <span>清除筛选</span>
            </button>
          )}
        </div>
      </div>

      {/* Project List */}
      <div className="flex flex-col gap-6">
        {projectGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <i className="fas fa-folder-open text-3xl text-text-muted/40 mb-3" />
            <p className="text-sm text-text-muted">暂无匹配的项目</p>
          </div>
        )}

        {projectGroups.map((group) => {
          const isParentExpanded = expandedIds.has(group.parent.id);

          return (
            <div key={group.parent.id} className="flex flex-col gap-2">
              {/* Parent Project Section Header */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleExpand(group.parent.id)}
                  className="flex flex-1 items-center gap-3 rounded-xl border-l-4 bg-bg-secondary/50 px-4 py-3 transition-all duration-200 hover:bg-bg-secondary/80"
                  style={{ borderLeftColor: group.parent.color || '#00d4ff' }}
                >
                  <div
                    className={`shrink-0 text-text-muted transition-transform duration-300 ${
                      isParentExpanded ? 'rotate-90' : ''
                    }`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: group.parent.color || '#00d4ff' }}
                  />
                  <h2 className="text-base font-display font-bold text-text-primary">
                    {group.parent.name || '未命名项目'}
                  </h2>
                  <span className="rounded-full bg-accent-cyan/10 px-2 py-0.5 text-xs font-medium text-accent-cyan">
                    {group.subProjects.length} 个子项目
                  </span>
                  <span className="text-xs text-text-muted ml-auto">
                    负责人: {group.parent.owner}
                  </span>
                </button>

                {/* Parent project action buttons - 仅负责人可操作 */}
                {isOwner(group.parent) && (
                  <>
                    <button
                      onClick={() => handleCreateSub(group.parent.id)}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 px-3 text-xs font-medium text-accent-cyan transition-all hover:bg-accent-cyan/10 shrink-0"
                      title="添加子项目"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      添加子项目
                    </button>
                    <button
                      onClick={() => handleEdit(group.parent.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-custom bg-bg-tertiary/50 text-text-muted hover:text-accent-cyan hover:border-accent-cyan/30 transition-all shrink-0"
                      title="编辑大项目"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(group.parent)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-custom bg-bg-tertiary/50 text-text-muted hover:text-accent-red hover:border-accent-red/30 transition-all shrink-0"
                      title="删除大项目"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Sub-projects list - 使用折叠动画 */}
              <CollapsibleSection isExpanded={isParentExpanded}>
                <div className="flex flex-col gap-1.5 ml-2">
                  {group.subProjects.map((sub) => {
                    const latest = getLatestByProject(sub.id);
                    const allEntries = getByProject(sub.id);
                    // Sort by date desc, take most recent 10
                    const recentEntries = [...allEntries]
                      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
                      .slice(0, 10);

                    return (
                      <ProjectRow
                        key={sub.id}
                        project={sub}
                        latestProgress={latest}
                        recentEntries={recentEntries}
                        isExpanded={expandedIds.has(sub.id)}
                        onToggle={() => toggleExpand(sub.id)}
                        onEditProject={() => handleEdit(sub.id)}
                        onDeleteProject={() => handleDelete(sub)}
                        onEditProgress={handleEditProgress}
                        onDeleteProgress={handleDeleteProgress}
                        canEdit={isOwner(sub)}
                      />
                    );
                  })}
                </div>
              </CollapsibleSection>
            </div>
          );
        })}
      </div>

      {/* Project Editor Modal */}
      <ProjectEditorModal
        open={modalOpen}
        onClose={handleCloseModal}
        projectId={editingProjectId}
        parentId={parentForNew}
      />

      {/* 进度编辑弹窗 */}
      <ProgressEditorModal
        open={progressModalOpen}
        onClose={handleCloseProgressModal}
        progressId={editingProgressId}
      />
    </div>
  );
}
