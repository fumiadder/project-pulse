import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { useUserStore } from '@/stores/useUserStore';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusTag } from '@/components/shared/StatusTag';
import { FilterBar } from '@/components/shared/FilterBar';
import { ProjectEditorModal } from '@/components/modals/ProjectEditorModal';
import type { Project, Progress } from '@/types';

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
  }

  if (filter === 'danger' && (project.status === '延期' || project.status === 'delayed')) return true;
  if (filter === 'warning' && (project.status === '有风险' || project.status === 'at-risk')) return true;
  if (filter === 'normal' && (project.status === '正常' || project.status === '进行中' || project.status === '完成')) return true;

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
  // Handle both full ISO and date-only strings
  return dateStr.slice(0, 10);
}

/** Collapsible project row with expandable progress entries */
function ProjectRow({
  project,
  latestProgress,
  recentEntries,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  project: Project;
  latestProgress: Progress | undefined;
  recentEntries: Progress[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const percent = latestProgress?.percent ?? 0;
  const tagStatus = latestProgress?.status ?? mapStatusToTag(project.status);

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
            {project.name}
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
          <StatusTag status={tagStatus} />
        </div>

        {/* Progress */}
        <div className="hidden lg:flex items-center gap-2 w-32 shrink-0">
          <ProgressBar percent={percent} size="sm" />
          <span className="text-xs text-text-secondary w-8 text-right">{percent}%</span>
        </div>

        {/* Dates */}
        <span className="hidden xl:inline text-xs text-text-muted w-20 text-right shrink-0">
          {formatDate(project.startDate)}
        </span>
        <span className="hidden xl:inline text-xs text-text-muted w-20 text-right shrink-0">
          {formatDate(project.endDate)}
        </span>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10 transition-all"
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded: Recent Progress Entries */}
      {isExpanded && (
        <div className="ml-8 mt-1 flex flex-col gap-2 border-l-2 border-border-custom pl-4 pb-2">
          {recentEntries.length === 0 && (
            <p className="py-3 text-xs text-text-muted/50">暂无进度记录</p>
          )}
          {recentEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg bg-bg-tertiary/50 px-4 py-3 transition-all duration-200 hover:bg-bg-tertiary/80"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-accent-cyan">{entry.date}</span>
                  <StatusTag status={entry.status} />
                  <span className="text-xs text-text-secondary">{entry.percent}%</span>
                </div>
              </div>
              {entry.content && (
                <p className="text-xs text-text-secondary leading-relaxed mb-1">
                  {entry.content}
                </p>
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
      )}
    </div>
  );
}

export function ProjectsPage() {
  const { projects, getParentProjects, getSubProjects, loadProjects, deleteProject } = useProjectStore();
  const { entries, getByProject, loadProgress, getLatestByProject } = useProgressStore();
  const { currentUser } = useUserStore();

  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [parentForNew, setParentForNew] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    loadProjects();
    loadProgress();
  }, []);

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
      // Delete sub-projects first if any
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

  // Group by parent project
  const projectGroups = useMemo(() => {
    const parents = getParentProjects();

    return parents
      .map((parent) => {
        // Get all sub-projects (show all owners)
        const subs = getSubProjects(parent.id);

        // Apply search and status filters
        const filtered = subs.filter((sub) => {
          if (searchValue && !sub.name.toLowerCase().includes(searchValue.toLowerCase())) {
            return false;
          }
          const latest = getLatestByProject(sub.id);
          return matchesStatusFilter(sub, latest, statusFilter);
        });

        if (filtered.length === 0) return null;

        return {
          parent,
          subProjects: filtered,
        };
      })
      .filter(Boolean) as { parent: Project; subProjects: Project[] }[];
  }, [projects, currentUser, searchValue, statusFilter, entries]);

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

      {/* Filter Bar */}
      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        placeholder="搜索项目名称..."
      />

      {/* Project List */}
      <div className="flex flex-col gap-6">
        {projectGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <i className="fas fa-folder-open text-3xl text-text-muted/40 mb-3" />
            <p className="text-sm text-text-muted">暂无匹配的项目</p>
          </div>
        )}

        {projectGroups.map((group) => (
          <div key={group.parent.id} className="flex flex-col gap-2">
            {/* Parent Project Section Header */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleExpand(group.parent.id)}
                className="flex flex-1 items-center gap-3 rounded-xl border-l-4 bg-bg-secondary/50 px-4 py-3 transition-all duration-200 hover:bg-bg-secondary/80"
                style={{ borderLeftColor: group.parent.color || '#00d4ff' }}
              >
                <div
                  className={`shrink-0 text-text-muted transition-transform duration-200 ${
                    expandedIds.has(group.parent.id) ? 'rotate-90' : ''
                  }`}
                >
                  <ChevronRight className="h-4 w-4" />
                </div>
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: group.parent.color || '#00d4ff' }}
                />
                <h2 className="text-base font-display font-bold text-text-primary">
                  {group.parent.name}
                </h2>
                <span className="rounded-full bg-accent-cyan/10 px-2 py-0.5 text-xs font-medium text-accent-cyan">
                  {group.subProjects.length} 个子项目
                </span>
                <span className="text-xs text-text-muted ml-auto">
                  负责人: {group.parent.owner}
                </span>
              </button>

              {/* Parent project action buttons */}
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
            </div>

            {/* Sub-projects list */}
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
                    onEdit={() => handleEdit(sub.id)}
                    onDelete={() => handleDelete(sub)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Project Editor Modal */}
      <ProjectEditorModal
        open={modalOpen}
        onClose={handleCloseModal}
        projectId={editingProjectId}
        parentId={parentForNew}
      />
    </div>
  );
}
