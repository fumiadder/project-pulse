import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useTodoStore } from '@/stores/useTodoStore';
import { useCheckinStore } from '@/stores/useCheckinStore';
import { useUserStore } from '@/stores/useUserStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUIStore } from '@/stores/useUIStore';
import { TodoEditorModal } from '@/components/modals/TodoEditorModal';
import { CheckinEditorModal } from '@/components/modals/CheckinEditorModal';
import { CircularProgress } from '@/components/shared/CircularProgress';
import { GreetingCard } from '@/components/shared/GreetingCard';
import { WeeklyHeatmap } from '@/components/shared/WeeklyHeatmap';
import { getReminderLabel, parseReminderConfig } from '@/utils/reminder';
import type { Todo, CheckIn } from '@/types';

// ============================================
// 辅助函数
// ============================================

/** 从 HTML 描述中提取纯文本 */
function stripHtml(html: string): string {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return (temp.textContent || '').trim();
}

/** 艾森豪威尔矩阵分类配置 */
const EISENHOWER_CATEGORIES = [
  { value: '紧急重要', label: '紧急重要', priority: 'high', color: 'bg-accent-red/10 text-accent-red', dot: 'bg-accent-red', bar: 'bg-accent-red', icon: 'fa-exclamation-circle' },
  { value: '重要不紧急', label: '重要不紧急', priority: 'medium', color: 'bg-accent-orange/10 text-accent-orange', dot: 'bg-accent-orange', bar: 'bg-accent-orange', icon: 'fa-star' },
  { value: '紧急不重要', label: '紧急不重要', priority: 'medium', color: 'bg-accent-cyan/10 text-accent-cyan', dot: 'bg-accent-cyan', bar: 'bg-accent-cyan', icon: 'fa-bolt' },
  { value: '不重要不紧急', label: '不重要不紧急', priority: 'low', color: 'bg-bg-tertiary text-text-muted', dot: 'bg-text-muted', bar: 'bg-text-muted', icon: 'fa-minus-circle' },
] as const;

function getCategoryConfig(category: string) {
  return EISENHOWER_CATEGORIES.find(c => c.value === category) ?? EISENHOWER_CATEGORIES[1];
}

function getCategoryBar(category: string): string {
  return getCategoryConfig(category).bar;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return '待开始';
    case 'in-progress': return '进行中';
    case 'completed': return '已完成';
    default: return status;
  }
}

function getStatusStyle(status: string): string {
  switch (status) {
    case 'completed': return 'text-accent-green';
    case 'in-progress': return 'text-accent-orange';
    case 'pending': return 'text-accent-cyan';
    default: return 'text-text-muted';
  }
}

function isOverdue(todo: Todo): boolean {
  if (todo.status === 'completed' || !todo.dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return todo.dueDate < today;
}

function isDueToday(todo: Todo): boolean {
  if (!todo.dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return todo.dueDate === today;
}

function formatDueDate(dateStr: string): string {
  if (!dateStr) return '';
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return '今天';
  if (dateStr === tomorrow) return '明天';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatCreatedAt(isoStr: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isReminderSoon(todo: Todo): boolean {
  if (!todo.reminderTime || todo.status === 'completed') return false;
  const config = parseReminderConfig(todo.reminderTime);
  if (config.type !== 'once' || !config.datetime) return false;
  const diff = new Date(config.datetime).getTime() - Date.now();
  return diff > 0 && diff < 30 * 60 * 1000;
}

function getProgressPercent(status: string, subtasks?: { done: boolean }[]): number {
  if (subtasks && subtasks.length > 0) {
    const done = subtasks.filter(s => s.done).length;
    return Math.round((done / subtasks.length) * 100);
  }
  switch (status) {
    case 'completed': return 100;
    case 'in-progress': return 50;
    default: return 0;
  }
}

function getProgressColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-accent-green';
    case 'in-progress': return 'bg-accent-orange';
    default: return 'bg-text-muted/30';
  }
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ============================================
// 任务卡片组件
// ============================================
function TodoCard({
  todo,
  onToggle,
  onEdit,
  onDelete,
  onPin,
  onToggleSubtask,
}: {
  todo: Todo;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  onToggleSubtask: (subtaskId: string) => void;
}) {
  const overdue = isOverdue(todo);
  const dueToday = isDueToday(todo);
  const catConfig = getCategoryConfig(todo.category);
  const barColor = getCategoryBar(todo.category);
  const progress = getProgressPercent(todo.status, todo.subtasks);
  const progressColor = getProgressColor(todo.status);
  const completedSubtasks = todo.subtasks?.filter(s => s.done).length ?? 0;

  return (
    <div
      onClick={onEdit}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-bg-secondary transition-all hover:border-accent-cyan/40 hover:shadow-lg hover:shadow-accent-cyan/5 ${
        todo.status === 'completed'
          ? 'border-border-custom opacity-60'
          : overdue
          ? 'border-accent-red/30'
          : 'border-border-custom'
      }`}
    >
      <div className={`absolute left-0 top-0 h-full w-1 ${barColor} ${todo.status === 'completed' ? 'opacity-30' : ''}`} />

      <div className="flex flex-col gap-2 p-4 pl-5">
        {/* 顶部：复选框 + 标题 + 操作按钮 */}
        <div className="flex items-start gap-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all ${
              todo.status === 'completed'
                ? 'border-accent-green bg-accent-green/20 text-accent-green'
                : 'border-border-hover text-transparent hover:border-accent-cyan hover:text-accent-cyan/50'
            }`}
          >
            <i className="fas fa-check text-[10px]" />
          </button>

          <span className={`flex-1 text-sm font-medium leading-snug ${todo.status === 'completed' ? 'line-through text-text-muted' : 'text-text-primary'}`}>
            {todo.title}
          </span>

          {/* 置顶按钮 — 始终可见 */}
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded transition-all ${
              todo.pinned
                ? 'text-accent-orange bg-accent-orange/10'
                : 'text-text-muted hover:text-accent-orange hover:bg-accent-orange/10'
            }`}
            title={todo.pinned ? '取消置顶' : '置顶到今日聚焦'}
          >
            <i className={`fas fa-star text-xs ${todo.pinned ? 'animate-pulse' : ''}`} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-all hover:bg-accent-red/10 hover:text-accent-red group-hover:opacity-100"
            title="删除"
          >
            <i className="fas fa-trash text-xs" />
          </button>
        </div>

        {/* 描述预览 */}
        {(() => {
          const descText = stripHtml(todo.description);
          return descText ? (
            <p className={`text-xs text-text-secondary line-clamp-2 ${todo.status === 'completed' ? 'opacity-50' : ''}`}>
              {descText}
            </p>
          ) : null;
        })()}

        {/* 子任务进度 */}
        {todo.subtasks && todo.subtasks.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md bg-bg-primary/50 px-2.5 py-1.5">
            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <span><i className="fas fa-list-check mr-1" />子任务</span>
              <span>{completedSubtasks}/{todo.subtasks.length}</span>
            </div>
            {todo.subtasks.slice(0, 3).map((st) => (
              <div key={st.id} className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSubtask(st.id); }}
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[8px] ${
                    st.done ? 'border-accent-green bg-accent-green/20 text-accent-green' : 'border-border-hover text-transparent'
                  }`}
                >
                  {st.done && <i className="fas fa-check" />}
                </button>
                <span className={`text-[10px] ${st.done ? 'line-through text-text-muted' : 'text-text-secondary'}`}>
                  {st.title}
                </span>
              </div>
            ))}
            {todo.subtasks.length > 3 && (
              <span className="text-[10px] text-text-muted pl-5">还有 {todo.subtasks.length - 3} 项...</span>
            )}
          </div>
        )}

        {/* 元信息 */}
        <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${catConfig.color}`}>
            <i className={`fas ${catConfig.icon} text-[9px]`} />
            {catConfig.label}
          </span>
          <span className={`text-[10px] font-medium ${getStatusStyle(todo.status)}`}>
            <i className={`fas ${todo.status === 'completed' ? 'fa-check-circle' : todo.status === 'in-progress' ? 'fa-spinner' : 'fa-circle'} mr-1`} />
            {getStatusLabel(todo.status)}
          </span>
        </div>

        {/* 标签 */}
        {todo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {todo.tags.map((tag, i) => (
              <span key={i} className="rounded bg-accent-purple/10 px-1.5 py-0.5 text-[10px] text-accent-purple">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 图片缩略图 */}
        {todo.images && todo.images.length > 0 && (
          <div className="flex gap-1.5">
            {todo.images.slice(0, 4).map((img, i) => (
              <div key={i} className="relative h-12 w-12 overflow-hidden rounded-md border border-border-custom">
                <img src={img} alt={`图片${i + 1}`} className="h-full w-full object-cover" />
                {i === 3 && todo.images.length > 4 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white font-medium">
                    +{todo.images.length - 4}
                  </div>
                )}
              </div>
            ))}
            <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
              <i className="fas fa-image" />
              {todo.images.length}
            </span>
          </div>
        )}

        {/* 时间信息 */}
        <div className="flex flex-col gap-1 rounded-md bg-bg-primary/50 px-2.5 py-2 text-[10px]">
          <div className="flex items-center gap-1.5 text-text-muted">
            <i className="fas fa-calendar-plus text-text-muted/60" />
            <span>创建：{formatCreatedAt(todo.createdAt)}</span>
          </div>
          {todo.dueDate && (
            <div className={`flex items-center gap-1.5 ${overdue ? 'text-accent-red font-medium' : dueToday ? 'text-accent-orange font-medium' : 'text-text-muted'}`}>
              <i className="fas fa-calendar-times" />
              <span>截止：{formatDueDate(todo.dueDate)}{overdue && '（逾期）'}{dueToday && '（今天）'}</span>
            </div>
          )}
          {todo.reminderTime && (() => {
            const label = getReminderLabel(todo.reminderTime);
            if (!label) return null;
            return (
              <div className={`flex items-center gap-1.5 ${isReminderSoon(todo) ? 'text-accent-orange font-medium animate-pulse' : 'text-text-muted'}`}>
                <i className="fas fa-bell" />
                <span>{label}{isReminderSoon(todo) && '（即将提醒）'}</span>
              </div>
            );
          })()}
        </div>

        {/* 进度条 */}
        <div className="flex items-center gap-2 pt-1">
          <div className="h-1.5 flex-1 rounded-full bg-bg-tertiary overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${progress}%` }} />
          </div>
          <span className={`text-[10px] font-medium ${getStatusStyle(todo.status)}`}>{progress}%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 打卡卡片组件
// ============================================
function CheckinCard({
  checkin,
  onToggle,
  onEdit,
  onDelete,
}: {
  checkin: CheckIn;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const today = getTodayStr();
  const doneToday = checkin.lastDoneDate === today;

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border-custom bg-bg-secondary p-3 transition-all hover:border-border-hover">
      {/* 打卡按钮 */}
      <button
        onClick={onToggle}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg transition-all ${
          doneToday ? 'scale-105 shadow-lg' : 'hover:scale-105'
        }`}
        style={{
          backgroundColor: doneToday ? checkin.color : `${checkin.color}20`,
          color: doneToday ? '#fff' : checkin.color,
        }}
        title={doneToday ? '今日已打卡' : '点击打卡'}
      >
        {checkin.emoji}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">{checkin.name}</span>
          {doneToday && (
            <span className="rounded px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: `${checkin.color}20`, color: checkin.color }}>
              已完成
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
          <span><i className="fas fa-fire mr-0.5" style={{ color: checkin.color }} />连续 {checkin.streak} 天</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={onEdit} className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-accent-cyan" title="编辑">
          <i className="fas fa-pen text-[10px]" />
        </button>
        <button onClick={onDelete} className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-accent-red" title="删除">
          <i className="fas fa-trash text-[10px]" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// 快速操作按钮
// ============================================
function QuickAddButton({ icon, label, color, onClick }: { icon: string; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-lg border border-border-custom bg-bg-secondary p-3 transition-all hover:border-border-hover hover:shadow-md"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        <i className={`fas ${icon} text-sm`} />
      </div>
      <span className="text-[11px] font-medium text-text-secondary">{label}</span>
    </button>
  );
}

// ============================================
// 功能说明提示条
// ============================================
function FeatureHint({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-accent-cyan/5 px-2.5 py-1 text-[10px] text-text-muted">
      <i className={`fas ${icon} text-accent-cyan/60`} />
      <span>{text}</span>
    </div>
  );
}

// ============================================
// 主页面
// ============================================
export function WorkbenchPage() {
  const { todos, isLoading, loadTodos, toggleComplete, deleteTodo, togglePin, toggleSubtask } = useTodoStore();
  const { checkins, loadCheckins, toggleToday, deleteCheckin } = useCheckinStore();
  const { currentUser } = useUserStore();
  const { entries: progressEntries, loadProgress } = useProgressStore();
  const { projects, loadProjects } = useProjectStore();
  const { setActivePage } = useUIStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [editingCheckinId, setEditingCheckinId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFeatureGuide, setShowFeatureGuide] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTodos(currentUser?.id);
    loadCheckins(currentUser?.id);
    loadProgress(currentUser?.id);
    loadProjects();
  }, [loadTodos, loadCheckins, loadProgress, loadProjects, currentUser?.id]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略在输入框中的按键
      const target = e.target as HTMLElement;
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      if (e.key === 'Escape') {
        if (modalOpen) setModalOpen(false);
        else if (checkinModalOpen) setCheckinModalOpen(false);
        else if (searchQuery) setSearchQuery('');
        return;
      }

      if (isInputFocused) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditingId(null);
        setModalOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, checkinModalOpen, searchQuery]);

  // 统计数据
  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.status === 'completed').length;
    const inProgress = todos.filter((t) => t.status === 'in-progress').length;
    const pending = todos.filter((t) => t.status === 'pending').length;
    const overdue = todos.filter((t) => isOverdue(t)).length;
    const pinned = todos.filter((t) => t.pinned && t.status !== 'completed').length;
    return { total, completed, inProgress, pending, overdue, pinned };
  }, [todos]);

  const today = getTodayStr();

  // 今日打卡统计
  const checkinStats = useMemo(() => {
    const total = checkins.length;
    const doneToday = checkins.filter((c) => c.lastDoneDate === today).length;
    return { total, doneToday };
  }, [checkins, today]);

  // 今日进度统计
  const progressStats = useMemo(() => {
    const todayEntries = progressEntries.filter((e) => e.date === today);
    return { count: todayEntries.length };
  }, [progressEntries, today]);

  // 项目统计
  const projectStats = useMemo(() => {
    const active = projects.filter((p) => p.status !== 'completed' && p.status !== 'cancelled').length;
    return { total: projects.length, active };
  }, [projects]);

  // 每日概览百分比
  const todoPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const checkinPercent = checkinStats.total > 0 ? Math.round((checkinStats.doneToday / checkinStats.total) * 100) : 0;
  const progressPercent = progressStats.count > 0 ? Math.min(100, progressStats.count * 25) : 0;
  const projectPercent = projectStats.total > 0 ? Math.round((projectStats.active / projectStats.total) * 100) : 0;

  // 置顶的待办（今日聚焦）
  const pinnedTodos = useMemo(() => {
    return todos.filter((t) => t.pinned && t.status !== 'completed').sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [todos]);

  // 过滤后的待办列表
  const filteredTodos = useMemo(() => {
    let result = todos.filter((t) => !t.pinned || t.status === 'completed');

    // 隐藏已完成
    if (!showCompleted) {
      result = result.filter((t) => t.status !== 'completed');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          stripHtml(t.description).toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    if (filterCategory !== 'all') {
      result = result.filter((t) => t.category === filterCategory);
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'overdue') {
        result = result.filter((t) => isOverdue(t));
      } else {
        result = result.filter((t) => t.status === filterStatus);
      }
    }

    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return result.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [todos, searchQuery, filterCategory, filterStatus, showCompleted]);

  const handleAdd = useCallback(() => {
    setEditingId(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((id: string) => {
    setEditingId(id);
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (window.confirm('确定要删除这个待办吗？')) {
        await deleteTodo(id);
      }
    },
    [deleteTodo],
  );

  const handleAddCheckin = useCallback(() => {
    setEditingCheckinId(null);
    setCheckinModalOpen(true);
  }, []);

  const handleEditCheckin = useCallback((id: string) => {
    setEditingCheckinId(id);
    setCheckinModalOpen(true);
  }, []);

  const handleDeleteCheckin = useCallback(
    async (id: string) => {
      if (window.confirm('确定要删除这个打卡项吗？')) {
        await deleteCheckin(id);
      }
    },
    [deleteCheckin],
  );

  const handleClearCompleted = useCallback(async () => {
    const completedTodos = todos.filter((t) => t.status === 'completed');
    if (completedTodos.length === 0) return;
    if (window.confirm(`确定要清除 ${completedTodos.length} 条已完成的待办吗？此操作不可撤销。`)) {
      for (const todo of completedTodos) {
        await deleteTodo(todo.id);
      }
    }
  }, [todos, deleteTodo]);

  // 导航到进度页（日历视图）
  const handleNavigateProgress = useCallback(() => {
    setActivePage('calendar');
  }, [setActivePage]);

  // 导航到私密区（想法）
  const handleNavigateIdeas = useCallback(() => {
    setActivePage('private-zone');
  }, [setActivePage]);

  // 生产力洞察
  const insights = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.status === 'completed').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const highPriorityDone = todos.filter((t) => t.priority === 'high' && t.status === 'completed').length;
    const highPriorityTotal = todos.filter((t) => t.priority === 'high').length;
    const todayCompleted = todos.filter((t) => {
      if (t.status !== 'completed' || !t.completedAt) return false;
      return t.completedAt.slice(0, 10) === getTodayStr();
    }).length;

    // 本周完成数
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCompleted = todos.filter((t) => {
      if (t.status !== 'completed' || !t.completedAt) return false;
      return new Date(t.completedAt) >= weekAgo;
    }).length;

    let tip = '';
    if (completionRate >= 80) tip = '效率出色！继续保持节奏';
    else if (completionRate >= 60) tip = '进展不错，再加把劲';
    else if (completionRate >= 40) tip = '完成率有待提升，建议聚焦高优任务';
    else if (total > 0) tip = '还有很多待办未完成，先从紧急重要的开始吧';
    else tip = '开始创建你的第一个待办吧';

    return {
      completionRate,
      highPriorityDone,
      highPriorityTotal,
      todayCompleted,
      weekCompleted,
      tip,
    };
  }, [todos]);

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary font-display flex items-center gap-2">
            <span className="inline-block h-5 w-1 rounded-full bg-accent-cyan" />
            今日工作
            <span className="text-[10px] font-normal text-text-muted ml-1">TODAY · WORK</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5 ml-3">
            管理你的待办事项、每日打卡和完成进度
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-bg-primary transition-colors hover:bg-accent-cyan/80"
          title="新建待办 (快捷键: N)"
        >
          <i className="fas fa-plus" />
          <span className="hidden sm:inline">新建待办</span>
          <kbd className="hidden sm:inline rounded bg-bg-primary/20 px-1.5 py-0.5 text-[9px] font-mono">N</kbd>
        </button>
      </div>

      {/* 今日聚焦 — 置顶区域（全宽卡片展示，位于最顶部） */}
      {pinnedTodos.length > 0 && (
        <div className="rounded-xl border border-accent-orange/20 bg-gradient-to-br from-accent-orange/5 to-bg-secondary p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <i className="fas fa-star text-accent-orange text-xs" />
              <span className="text-xs font-bold text-text-primary">今日聚焦</span>
              <span className="text-[9px] text-text-muted">TODAY'S FOCUS</span>
              <span className="rounded-full bg-accent-orange/15 px-2 py-0.5 text-[9px] text-accent-orange">{pinnedTodos.length}项置顶</span>
            </div>
            <span className="text-[10px] text-text-muted">点击星标可取消置顶</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pinnedTodos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                onToggle={() => toggleComplete(todo.id)}
                onEdit={() => handleEdit(todo.id)}
                onDelete={() => handleDelete(todo.id)}
                onPin={() => togglePin(todo.id)}
                onToggleSubtask={(subtaskId) => toggleSubtask(todo.id, subtaskId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 第一行：问候卡 + 快速记录 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GreetingCard>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-accent-cyan">{stats.pending}</div>
                  <div className="text-[9px] text-text-muted">待开始</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-accent-orange">{stats.inProgress}</div>
                  <div className="text-[9px] text-text-muted">进行中</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-accent-green">{stats.completed}</div>
                  <div className="text-[9px] text-text-muted">已完成</div>
                </div>
              </div>
            </div>
          </GreetingCard>
        </div>

        {/* 快速记录 */}
        <div className="rounded-xl border border-border-primary/30 bg-bg-secondary p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <i className="fas fa-bolt text-accent-cyan text-xs" />
            <span className="text-xs font-bold text-text-primary">快速记录</span>
            <span className="text-[9px] text-text-muted">QUICK ADD</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <QuickAddButton icon="fa-list-check" label="记待办" color="bg-accent-cyan/10 text-accent-cyan" onClick={handleAdd} />
            <QuickAddButton icon="fa-check-circle" label="记打卡" color="bg-accent-green/10 text-accent-green" onClick={handleAddCheckin} />
            <QuickAddButton icon="fa-chart-line" label="记进度" color="bg-accent-orange/10 text-accent-orange" onClick={handleNavigateProgress} />
            <QuickAddButton icon="fa-lightbulb" label="记想法" color="bg-accent-purple/10 text-accent-purple" onClick={handleNavigateIdeas} />
          </div>
        </div>
      </div>

      {/* 第二行：每日概览 + 统计汇总 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* 每日概览 — 圆环进度 */}
        <div className="lg:col-span-2 rounded-xl border border-border-primary/30 bg-bg-secondary p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <i className="fas fa-chart-pie text-accent-cyan text-xs" />
              <span className="text-xs font-bold text-text-primary">今日概览</span>
              <span className="text-[9px] text-text-muted">DAILY VITALS</span>
            </div>
            <FeatureHint icon="fa-info-circle" text="各模块今日完成率一目了然" />
          </div>
          <div className="flex items-center justify-around gap-2 overflow-x-auto pb-1">
            <CircularProgress
              percent={todoPercent}
              color="#00d4ff"
              icon="fa-list-check"
              label="待办完成"
              subtext={`${stats.completed}/${stats.total}项`}
            />
            <CircularProgress
              percent={checkinPercent}
              color="#4a9a7a"
              icon="fa-check-circle"
              label="每日打卡"
              subtext={`${checkinStats.doneToday}/${checkinStats.total}项`}
            />
            <CircularProgress
              percent={progressPercent}
              color="#c4945a"
              icon="fa-chart-line"
              label="进度更新"
              subtext={`${progressStats.count}条`}
            />
            <CircularProgress
              percent={projectPercent}
              color="#a855f7"
              icon="fa-project-diagram"
              label="活跃项目"
              subtext={`${projectStats.active}个`}
            />
          </div>
        </div>

        {/* 统计汇总 */}
        <div className="rounded-xl border border-border-primary/30 bg-gradient-to-br from-bg-tertiary to-bg-secondary p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <i className="fas fa-database text-accent-purple text-xs" />
            <span className="text-xs font-bold text-text-primary">数据汇总</span>
            <span className="text-[9px] text-text-muted">SUMMARY</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-layer-group text-accent-cyan text-xs w-4" />
                <span className="text-xs text-text-secondary">累计待办</span>
              </div>
              <span className="text-sm font-bold text-text-primary">{stats.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-star text-accent-orange text-xs w-4" />
                <span className="text-xs text-text-secondary">今日聚焦</span>
              </div>
              <span className="text-sm font-bold text-accent-orange">{stats.pinned}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-fire text-accent-green text-xs w-4" />
                <span className="text-xs text-text-secondary">打卡项</span>
              </div>
              <span className="text-sm font-bold text-text-primary">{checkinStats.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-exclamation-triangle text-accent-red text-xs w-4" />
                <span className="text-xs text-text-secondary">已逾期</span>
              </div>
              <span className="text-sm font-bold text-accent-red">{stats.overdue}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 第三行：每日打卡 + 生产力洞察 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 每日打卡 */}
        <div className="rounded-xl border border-border-primary/30 bg-bg-secondary p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <i className="fas fa-check-circle text-accent-green text-xs" />
              <span className="text-xs font-bold text-text-primary">每日打卡</span>
              <span className="text-[9px] text-text-muted">CHECKIN</span>
            </div>
            <button
              onClick={handleAddCheckin}
              className="flex items-center gap-1 rounded-md bg-accent-green/10 px-2 py-1 text-[10px] text-accent-green transition-colors hover:bg-accent-green/20"
            >
              <i className="fas fa-plus text-[9px]" />
              新增
            </button>
          </div>
          {checkins.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <i className="fas fa-fire text-2xl text-text-muted/20" />
              <p className="text-xs text-text-muted">
                还没有打卡项，点击"新增"创建第一个习惯吧
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {checkins.map((checkin) => (
                <CheckinCard
                  key={checkin.id}
                  checkin={checkin}
                  onToggle={() => toggleToday(checkin.id)}
                  onEdit={() => handleEditCheckin(checkin.id)}
                  onDelete={() => handleDeleteCheckin(checkin.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 生产力洞察 */}
        <div className="rounded-xl border border-border-primary/30 bg-gradient-to-br from-bg-tertiary to-bg-secondary p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <i className="fas fa-lightbulb text-accent-orange text-xs" />
            <span className="text-xs font-bold text-text-primary">生产力洞察</span>
            <span className="text-[9px] text-text-muted">INSIGHTS</span>
          </div>
          <div className="flex flex-col gap-3">
            {/* 总体完成率 */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">总体完成率</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-cyan transition-all duration-500"
                    style={{ width: `${insights.completionRate}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-accent-cyan">{insights.completionRate}%</span>
              </div>
            </div>

            {/* 今日完成 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-check-double text-accent-green text-xs w-4" />
                <span className="text-xs text-text-secondary">今日完成</span>
              </div>
              <span className="text-sm font-bold text-accent-green">{insights.todayCompleted} 项</span>
            </div>

            {/* 本周完成 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-calendar-week text-accent-cyan text-xs w-4" />
                <span className="text-xs text-text-secondary">本周完成</span>
              </div>
              <span className="text-sm font-bold text-accent-cyan">{insights.weekCompleted} 项</span>
            </div>

            {/* 高优完成 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-exclamation-circle text-accent-red text-xs w-4" />
                <span className="text-xs text-text-secondary">紧急重要完成</span>
              </div>
              <span className="text-sm font-bold text-accent-red">
                {insights.highPriorityDone}/{insights.highPriorityTotal}
              </span>
            </div>

            {/* 建议提示 */}
            <div className="rounded-lg bg-accent-orange/5 border border-accent-orange/20 px-3 py-2">
              <p className="text-[11px] text-accent-orange/90 flex items-start gap-1.5">
                <i className="fas fa-quote-left text-[9px] mt-0.5 shrink-0" />
                <span>{insights.tip}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 第四行：活动热力图（全宽） */}
      <div className="rounded-xl border border-border-primary/30 bg-bg-secondary p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <i className="fas fa-fire text-accent-green text-xs" />
            <span className="text-xs font-bold text-text-primary">活动热力图</span>
            <span className="text-[9px] text-text-muted">ACTIVITY MAP</span>
          </div>
          <FeatureHint icon="fa-info-circle" text="绿色越深表示当日完成待办越多" />
        </div>
        <WeeklyHeatmap todos={todos} weeks={8} />
      </div>

      {/* 搜索和过滤栏 */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索待办标题、描述或标签... (按 / 快速聚焦)"
            className="w-full rounded-lg border border-border-custom bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <i className="fas fa-times text-xs" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-text-muted">
            <i className="fas fa-sort-amount-down mr-1" />
            按优先级高→低 · 创建时间近→远
          </span>
          <div className="h-4 w-px bg-border-custom" />
          <div className="flex items-center gap-1">
            {[
              { v: 'all', l: '全部' },
              { v: 'pending', l: '待开始' },
              { v: 'in-progress', l: '进行中' },
              { v: 'completed', l: '已完成' },
              { v: 'overdue', l: '已逾期' },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setFilterStatus(opt.v)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  filterStatus === opt.v ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-border-custom" />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterCategory('all')}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                filterCategory === 'all' ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              全部分类
            </button>
            {EISENHOWER_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setFilterCategory(cat.value)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  filterCategory === cat.value ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-border-custom" />
          {/* 显示/隐藏已完成 */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
              showCompleted ? 'text-text-muted hover:text-text-primary' : 'text-accent-cyan bg-accent-cyan/10'
            }`}
          >
            <i className={`fas ${showCompleted ? 'fa-eye-slash' : 'fa-eye'} text-[10px]`} />
            {showCompleted ? '隐藏已完成' : '显示已完成'}
          </button>
          {/* 批量清除已完成 */}
          {stats.completed > 0 && (
            <button
              onClick={handleClearCompleted}
              className="flex items-center gap-1.5 rounded-md bg-accent-red/10 px-2.5 py-1 text-xs text-accent-red transition-colors hover:bg-accent-red/20"
            >
              <i className="fas fa-broom text-[10px]" />
              清除已完成 ({stats.completed})
            </button>
          )}
        </div>
      </div>

      {/* 待办卡片网格 */}
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <i className="fas fa-spinner fa-spin text-2xl text-accent-cyan" />
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-custom py-16">
            <i className="fas fa-clipboard-list text-4xl text-text-muted/30" />
            <p className="text-sm text-text-muted">
              {todos.length === 0 ? '还没有待办事项，点击右上角创建第一个吧' : '没有匹配的待办事项'}
            </p>
            {todos.length === 0 && (
              <button onClick={handleAdd} className="rounded-lg bg-accent-cyan/10 px-4 py-2 text-xs text-accent-cyan hover:bg-accent-cyan/20 transition-colors">
                <i className="fas fa-plus mr-1" />
                新建待办
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>共 {filteredTodos.length} 条结果</span>
              {(filterStatus !== 'all' || filterCategory !== 'all' || searchQuery) && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterStatus('all'); setFilterCategory('all'); }}
                  className="text-accent-cyan hover:underline"
                >
                  清除筛选
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTodos.map((todo) => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  onToggle={() => toggleComplete(todo.id)}
                  onEdit={() => handleEdit(todo.id)}
                  onDelete={() => handleDelete(todo.id)}
                  onPin={() => togglePin(todo.id)}
                  onToggleSubtask={(subtaskId) => toggleSubtask(todo.id, subtaskId)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 功能说明区 — 可折叠 */}
      <div className="rounded-xl border border-border-primary/20 bg-bg-secondary/50 overflow-hidden">
        <button
          onClick={() => setShowFeatureGuide(!showFeatureGuide)}
          className="flex w-full items-center justify-between p-4 transition-colors hover:bg-bg-tertiary/30"
        >
          <div className="flex items-center gap-1.5">
            <i className="fas fa-circle-info text-accent-cyan text-xs" />
            <span className="text-xs font-bold text-text-primary">功能说明 & 使用指南</span>
            <span className="text-[9px] text-text-muted">FEATURE GUIDE</span>
          </div>
          <i className={`fas fa-chevron-down text-xs text-text-muted transition-transform ${showFeatureGuide ? 'rotate-180' : ''}`} />
        </button>

        {showFeatureGuide && (
          <div className="border-t border-border-custom/50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* 待办管理 */}
              <div className="rounded-lg border border-border-custom/50 bg-bg-primary/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-cyan/10">
                    <i className="fas fa-list-check text-accent-cyan text-xs" />
                  </div>
                  <span className="text-xs font-bold text-text-primary">待办管理</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  创建待办时可选四种优先级分类（艾森豪威尔矩阵），系统自动推导高/中/低优先级。
                  点击卡片可编辑详情，卡片左侧色条标识分类，进度条自动计算完成率。
                </p>
              </div>

              {/* 子任务 */}
              <div className="rounded-lg border border-border-custom/50 bg-bg-primary/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-green/10">
                    <i className="fas fa-list-ul text-accent-green text-xs" />
                  </div>
                  <span className="text-xs font-bold text-text-primary">子任务</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  在编辑器中添加子任务细化步骤，勾选完成自动更新进度。
                  子任务进度条实时反映完成比例，帮助追踪复杂任务的执行情况。
                </p>
              </div>

              {/* 今日聚焦 */}
              <div className="rounded-lg border border-border-custom/50 bg-bg-primary/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-orange/10">
                    <i className="fas fa-star text-accent-orange text-xs" />
                  </div>
                  <span className="text-xs font-bold text-text-primary">今日聚焦</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  点击待办卡片上的星标按钮，将重要事项置顶到「今日聚焦」区域。
                  聚焦列表按优先级排序，帮助你集中精力处理最关键的任务。
                </p>
              </div>

              {/* 每日打卡 */}
              <div className="rounded-lg border border-border-custom/50 bg-bg-primary/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-green/10">
                    <i className="fas fa-fire text-accent-green text-xs" />
                  </div>
                  <span className="text-xs font-bold text-text-primary">每日打卡</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  创建习惯打卡项（如运动、阅读），每天点击完成打卡。
                  自动统计连续天数，培养好习惯。支持自定义图标和颜色。
                </p>
              </div>

              {/* 图片粘贴 */}
              <div className="rounded-lg border border-border-custom/50 bg-bg-primary/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-purple/10">
                    <i className="fas fa-image text-accent-purple text-xs" />
                  </div>
                  <span className="text-xs font-bold text-text-primary">图片粘贴 & 编辑</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  在描述编辑器中直接 Ctrl+V 粘贴图片，支持自动压缩。
                  点击图片可打开编辑器进行框选裁剪或删除，图片同时显示在卡片缩略图中。
                </p>
              </div>

              {/* 定时提醒 */}
              <div className="rounded-lg border border-border-custom/50 bg-bg-primary/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-orange/10">
                    <i className="fas fa-bell text-accent-orange text-xs" />
                  </div>
                  <span className="text-xs font-bold text-text-primary">定时提醒</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  支持三种提醒模式：指定时间（单次）、每天固定时间、按间隔重复。
                  需开启浏览器通知权限，提醒即将到来时卡片会闪烁提示。
                </p>
              </div>

              {/* 活动热力图 */}
              <div className="rounded-lg border border-border-custom/50 bg-bg-primary/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-green/10">
                    <i className="fas fa-fire text-accent-green text-xs" />
                  </div>
                  <span className="text-xs font-bold text-text-primary">活动热力图</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  可视化展示近 8 周的待办完成情况，绿色越深表示当日完成越多。
                  一目了然地看到你的工作节奏和活跃天数，帮助保持持续产出。
                </p>
              </div>

              {/* 生产力洞察 */}
              <div className="rounded-lg border border-border-custom/50 bg-bg-primary/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-orange/10">
                    <i className="fas fa-lightbulb text-accent-orange text-xs" />
                  </div>
                  <span className="text-xs font-bold text-text-primary">生产力洞察</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  自动统计总体完成率、今日/本周完成数、高优任务完成情况，
                  并根据数据智能给出效率建议，帮助你持续优化工作方式。
                </p>
              </div>

              {/* 快捷键 */}
              <div className="rounded-lg border border-border-custom/50 bg-bg-primary/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-cyan/10">
                    <i className="fas fa-keyboard text-accent-cyan text-xs" />
                  </div>
                  <span className="text-xs font-bold text-text-primary">快捷键</span>
                </div>
                <div className="flex flex-col gap-1 text-[11px] text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>新建待办</span>
                    <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[9px] font-mono text-text-muted">N</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>聚焦搜索框</span>
                    <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[9px] font-mono text-text-muted">/</kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>关闭弹窗/清除</span>
                    <kbd className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[9px] font-mono text-text-muted">Esc</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 编辑/新建弹窗 */}
      <TodoEditorModal open={modalOpen} onClose={() => setModalOpen(false)} todoId={editingId} />
      <CheckinEditorModal open={checkinModalOpen} onClose={() => setCheckinModalOpen(false)} checkinId={editingCheckinId} />
    </div>
  );
}
