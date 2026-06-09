import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { useUserStore } from '@/stores/useUserStore';
import { StatCard } from '@/components/shared/StatCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { ProgressEditorModal } from '@/components/modals/ProgressEditorModal';
import type { Project, Progress } from '@/types';

/** Get today's date as YYYY-MM-DD */
function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

/** Map status filter value to project status string matching */
function matchesStatusFilter(
  project: Project,
  latestProgress: Progress | undefined,
  filter: string
): boolean {
  if (filter === 'all') return true;

  // Check latest progress status
  if (latestProgress) {
    const tag = latestProgress.status;
    if (filter === 'normal' && tag === 'normal') return true;
    if (filter === 'warning' && tag === 'warning') return true;
    if (filter === 'danger' && tag === 'danger') return true;
  }

  // Also check project-level status
  if (filter === 'danger' && (project.status === '延期' || project.status === 'delayed')) return true;
  if (filter === 'warning' && (project.status === '有风险' || project.status === 'at-risk')) return true;
  if (filter === 'normal' && (project.status === '正常' || project.status === '进行中' || project.status === '完成')) return true;

  return false;
}

export function DashboardPage() {
  const { projects, getParentProjects, getSubProjects, loadProjects } = useProjectStore();
  const { entries, getByDate, loadProgress, getLatestByProject } = useProgressStore();
  const { currentUser } = useUserStore();

  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAllUsers, setShowAllUsers] = useState(false);

  // Progress modal state
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [preProjectId, setPreProjectId] = useState<string | undefined>(undefined);

  // Load data on mount
  useEffect(() => {
    loadProjects();
    loadProgress();
  }, []);

  const todayStr = getTodayStr();

  // Compute stats
  const stats = useMemo(() => {
    const myProjects = showAllUsers
      ? projects
      : currentUser
        ? projects.filter((p) => p.owner === currentUser.name)
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
  }, [projects, currentUser, entries, todayStr]);

  // Group parent projects with their sub-projects owned by current user
  const projectSections = useMemo(() => {
    const parents = getParentProjects();
    const ownerName = showAllUsers ? null : currentUser?.name;

    return parents
      .map((parent) => {
        const subs = getSubProjects(parent.id).filter(
          (sub) => !ownerName || sub.owner === ownerName
        );

        // Apply filters
        const filtered = subs.filter((sub) => {
          // Search filter
          if (searchValue && !sub.name.toLowerCase().includes(searchValue.toLowerCase())) {
            return false;
          }

          // Status filter
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

  // Open progress modal for a specific project
  const handleAddProgress = (projectId: string) => {
    setPreProjectId(projectId);
    setProgressModalOpen(true);
  };

  const handleCloseProgressModal = () => {
    setProgressModalOpen(false);
    setPreProjectId(undefined);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-cyan/10">
          <i className="fas fa-th-large text-accent-cyan text-lg" />
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-text-primary">控制台</h1>
          <p className="text-xs text-text-muted">
            {showAllUsers ? '全部项目总览' : `${currentUser?.name ?? ''} 的项目总览`}
          </p>
        </div>
        <button
          onClick={() => setShowAllUsers(prev => !prev)}
          className={`ml-auto rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
            showAllUsers
              ? 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan'
              : 'border-border-primary/30 bg-bg-secondary text-text-muted hover:text-text-secondary hover:border-border-hover'
          }`}
        >
          <i className={`fas ${showAllUsers ? 'fa-users' : 'fa-user'} mr-1.5`} />
          {showAllUsers ? '全部项目' : '查看全部'}
        </button>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="项目总数"
          value={stats.total}
          icon="fa-th-large"
          color="cyan"
        />
        <StatCard
          title="进行中"
          value={stats.inProgress}
          icon="fa-spinner"
          color="green"
        />
        <StatCard
          title="已完成"
          value={stats.completed}
          icon="fa-check-circle"
          color="orange"
        />
        <StatCard
          title="今日更新"
          value={stats.todayUpdates}
          icon="fa-clock"
          color="purple"
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        placeholder="搜索项目名称..."
      />

      {/* Main Content: Big Project Sections */}
      <div className="flex flex-col gap-6">
        {projectSections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <i className="fas fa-inbox text-3xl text-text-muted/40 mb-3" />
            <p className="text-sm text-text-muted">暂无匹配的项目</p>
          </div>
        )}

        {projectSections.map((section) => (
          <div key={section.parent.id} className="flex flex-col gap-3">
            {/* Big Project Header */}
            <div
              className="flex items-center gap-3 rounded-xl border-l-4 bg-bg-secondary/50 px-4 py-3"
              style={{ borderLeftColor: section.parent.color || '#00d4ff' }}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: section.parent.color || '#00d4ff' }}
              />
              <h2 className="text-base font-display font-bold text-text-primary">
                {section.parent.name}
              </h2>
              <span className="rounded-full bg-accent-cyan/10 px-2 py-0.5 text-xs font-medium text-accent-cyan">
                {section.subProjects.length} 个子项目
              </span>
            </div>

            {/* Sub-Project Cards: Horizontal Scrollable Row */}
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
              {section.subProjects.map((sub) => {
                const latest = getLatestByProject(sub.id);
                const percent = latest?.percent ?? 0;
                const tagStatus = latest?.status ?? mapStatusToTag(sub.status);
                const allEntries = entries
                  .filter((e) => e.projectId === sub.id)
                  .sort((a, b) => b.date.localeCompare(a.date));

                return (
                  <div
                    key={sub.id}
                    className="card-glass flex min-w-[280px] max-w-[320px] flex-1 flex-col gap-3 p-4 transition-all duration-300 hover:scale-[1.01]"
                  >
                    {/* Sub-project name + add progress button */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-text-primary leading-tight">
                        {sub.name}
                      </h3>
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

                    {/* Sub-project progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-bg-primary overflow-hidden">
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

                    {/* Daily progress list - all entries in unified format */}
                    {allEntries.length > 0 && (
                      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto border-t border-border-custom pt-2 scrollbar-thin">
                        {allEntries.map((entry) => {
                          const isToday = entry.date === todayStr;
                          return (
                            <div
                              key={entry.id}
                              className={`flex flex-col gap-1 rounded-lg px-3 py-2 transition-all ${
                                isToday
                                  ? 'border-l-[3px] border-l-accent-cyan bg-accent-cyan/10 ring-1 ring-accent-cyan/20 shadow-[0_0_8px_rgba(0,212,255,0.15)]'
                                  : 'bg-bg-primary/40'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-text-secondary">
                                  <i className="far fa-calendar mr-1" />
                                  {entry.date}
                                  {isToday && (
                                    <span className="ml-1.5 inline-flex items-center rounded-full bg-accent-cyan/20 px-2 py-0.5 text-[10px] font-bold text-accent-cyan shadow-[0_0_6px_rgba(0,212,255,0.3)]">
                                      今天
                                    </span>
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-text-muted leading-relaxed">
                                {entry.content || '暂无更新内容'}
                              </p>
                              {sub.owner && (
                                <span className="text-[10px] text-text-muted/60">
                                  <i className="far fa-user mr-1" />
                                  {sub.owner}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!latest && (
                      <div className="border-t border-border-custom pt-3">
                        <p className="text-xs text-text-muted/50">暂无进度记录</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Progress Editor Modal */}
      <ProgressEditorModal
        open={progressModalOpen}
        onClose={handleCloseProgressModal}
        preProjectId={preProjectId}
        preDate={todayStr}
      />
    </div>
  );
}
