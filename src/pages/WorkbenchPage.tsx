import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTodoStore } from '@/stores/useTodoStore';
import { useUserStore } from '@/stores/useUserStore';
import { TodoEditorModal } from '@/components/modals/TodoEditorModal';
import type { Todo } from '@/types';

/** 优先级样式映射 */
function getPriorityStyle(priority: string): { badge: string; dot: string } {
  switch (priority) {
    case 'high':
      return { badge: 'bg-accent-red/10 text-accent-red', dot: 'bg-accent-red' };
    case 'medium':
      return { badge: 'bg-accent-orange/10 text-accent-orange', dot: 'bg-accent-orange' };
    case 'low':
      return { badge: 'bg-accent-cyan/10 text-accent-cyan', dot: 'bg-accent-cyan' };
    default:
      return { badge: 'bg-bg-tertiary text-text-muted', dot: 'bg-text-muted' };
  }
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'high': return '高';
    case 'medium': return '中';
    case 'low': return '低';
    default: return priority;
  }
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

/** 检查是否逾期 */
function isOverdue(todo: Todo): boolean {
  if (todo.status === 'completed' || !todo.dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return todo.dueDate < today;
}

/** 检查是否今天到期 */
function isDueToday(todo: Todo): boolean {
  if (!todo.dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return todo.dueDate === today;
}

/** 格式化日期显示 */
function formatDueDate(dateStr: string): string {
  if (!dateStr) return '';
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return '今天';
  if (dateStr === tomorrow) return '明天';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 格式化创建时间 */
function formatCreatedAt(isoStr: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 格式化提醒时间 */
function formatReminderTime(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 检查提醒是否即将触发（30分钟内） */
function isReminderSoon(todo: Todo): boolean {
  if (!todo.reminderTime || todo.status === 'completed') return false;
  const diff = new Date(todo.reminderTime).getTime() - Date.now();
  return diff > 0 && diff < 30 * 60 * 1000;
}

/** 统计卡片组件 */
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-custom bg-bg-secondary px-4 py-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        <i className={`fas ${icon} text-base`} />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold text-text-primary leading-none">{value}</span>
        <span className="text-[10px] text-text-muted mt-1">{label}</span>
      </div>
    </div>
  );
}

/** 分类统计柱状图 */
function CategoryChart({ todos }: { todos: Todo[] }) {
  const categoryStats = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (const t of todos) {
      const cat = t.category || '未分类';
      if (!map.has(cat)) map.set(cat, { total: 0, completed: 0 });
      const stat = map.get(cat)!;
      stat.total++;
      if (t.status === 'completed') stat.completed++;
    }
    return Array.from(map.entries())
      .map(([cat, stat]) => ({ cat, ...stat, rate: stat.total > 0 ? (stat.completed / stat.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [todos]);

  if (categoryStats.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-custom bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-primary mb-3">
        <i className="fas fa-chart-pie text-accent-cyan mr-2" />
        分类完成率
      </h3>
      <div className="flex flex-col gap-2.5">
        {categoryStats.map((item) => (
          <div key={item.cat} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{item.cat}</span>
              <span className="text-text-muted">
                {item.completed}/{item.total} ({Math.round(item.rate)}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  item.rate === 100
                    ? 'bg-accent-green'
                    : item.rate >= 50
                    ? 'bg-accent-cyan'
                    : 'bg-accent-orange'
                }`}
                style={{ width: `${item.rate}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 优先级左侧色条 */
function getPriorityBar(priority: string): string {
  switch (priority) {
    case 'high': return 'bg-accent-red';
    case 'medium': return 'bg-accent-orange';
    case 'low': return 'bg-accent-cyan';
    default: return 'bg-text-muted';
  }
}

/** 根据状态获取进度百分比 */
function getProgressPercent(status: string): number {
  switch (status) {
    case 'completed': return 100;
    case 'in-progress': return 50;
    default: return 0;
  }
}

/** 根据状态获取进度条颜色 */
function getProgressColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-accent-green';
    case 'in-progress': return 'bg-accent-orange';
    default: return 'bg-text-muted/30';
  }
}

/** 任务卡片组件 — 卡片式，点击打开编辑进度 */
function TodoCard({
  todo,
  onToggle,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = isOverdue(todo);
  const dueToday = isDueToday(todo);
  const prio = getPriorityStyle(todo.priority);
  const barColor = getPriorityBar(todo.priority);
  const progress = getProgressPercent(todo.status);
  const progressColor = getProgressColor(todo.status);

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
      {/* 优先级色条 */}
      <div className={`absolute left-0 top-0 h-full w-1 ${barColor} ${todo.status === 'completed' ? 'opacity-30' : ''}`} />

      <div className="flex flex-col gap-2 p-4 pl-5">
        {/* 顶部：复选框 + 标题 + 删除按钮 */}
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

          <span
            className={`flex-1 text-sm font-medium leading-snug ${
              todo.status === 'completed' ? 'line-through text-text-muted' : 'text-text-primary'
            }`}
          >
            {todo.title}
          </span>

          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-all hover:bg-accent-red/10 hover:text-accent-red group-hover:opacity-100"
            title="删除"
          >
            <i className="fas fa-trash text-xs" />
          </button>
        </div>

        {/* 描述 */}
        {todo.description && (
          <p className={`text-xs text-text-secondary line-clamp-2 ${todo.status === 'completed' ? 'opacity-50' : ''}`}>
            {todo.description}
          </p>
        )}

        {/* 底部元信息 */}
        <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
          {/* 优先级标签 */}
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${prio.badge}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${prio.dot}`} />
            {getPriorityLabel(todo.priority)}
          </span>

          {/* 状态 */}
          <span className={`text-[10px] font-medium ${getStatusStyle(todo.status)}`}>
            <i className={`fas ${todo.status === 'completed' ? 'fa-check-circle' : todo.status === 'in-progress' ? 'fa-spinner' : 'fa-circle'} mr-1`} />
            {getStatusLabel(todo.status)}
          </span>

          {/* 分类 */}
          <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-secondary">
            <i className="fas fa-folder mr-1 text-text-muted" />
            {todo.category || '未分类'}
          </span>
        </div>

        {/* 标签行 */}
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
            {todo.images.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                <i className="fas fa-image" />
                {todo.images.length}
              </span>
            )}
          </div>
        )}

        {/* 时间信息区 */}
        <div className="flex flex-col gap-1 rounded-md bg-bg-primary/50 px-2.5 py-2 text-[10px]">
          {/* 创建时间 */}
          <div className="flex items-center gap-1.5 text-text-muted">
            <i className="fas fa-calendar-plus text-text-muted/60" />
            <span>创建：{formatCreatedAt(todo.createdAt)}</span>
          </div>

          {/* 截止日期 */}
          {todo.dueDate && (
            <div className={`flex items-center gap-1.5 ${
              overdue ? 'text-accent-red font-medium' : dueToday ? 'text-accent-orange font-medium' : 'text-text-muted'
            }`}>
              <i className="fas fa-calendar-times" />
              <span>
                截止：{formatDueDate(todo.dueDate)}
                {overdue && '（逾期）'}
                {dueToday && '（今天）'}
              </span>
            </div>
          )}

          {/* 提醒时间 */}
          {todo.reminderTime && (
            <div className={`flex items-center gap-1.5 ${
              isReminderSoon(todo) ? 'text-accent-orange font-medium animate-pulse' : 'text-text-muted'
            }`}>
              <i className="fas fa-bell" />
              <span>
                提醒：{formatReminderTime(todo.reminderTime)}
                {isReminderSoon(todo) && '（即将提醒）'}
              </span>
            </div>
          )}
        </div>

        {/* 进度条 */}
        <div className="flex items-center gap-2 pt-1">
          <div className="h-1.5 flex-1 rounded-full bg-bg-tertiary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={`text-[10px] font-medium ${getStatusStyle(todo.status)}`}>
            {progress}%
          </span>
        </div>

        {/* 悬停提示：点击编辑 */}
        <div className="flex items-center justify-center gap-1 rounded-md bg-accent-cyan/5 py-1 text-[10px] text-accent-cyan/0 transition-all group-hover:text-accent-cyan/70">
          <i className="fas fa-pen text-[9px]" />
          <span>点击编辑进度</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 主页面
// ============================================
export function WorkbenchPage() {
  const { todos, isLoading, loadTodos, toggleComplete, deleteTodo } = useTodoStore();
  const { currentUser } = useUserStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // 加载数据
  useEffect(() => {
    loadTodos(currentUser?.id);
  }, [loadTodos, currentUser?.id]);

  // 获取所有分类
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    todos.forEach((t) => { if (t.category) set.add(t.category); });
    return Array.from(set);
  }, [todos]);

  // 统计数据
  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.status === 'completed').length;
    const inProgress = todos.filter((t) => t.status === 'in-progress').length;
    const pending = todos.filter((t) => t.status === 'pending').length;
    const overdue = todos.filter((t) => isOverdue(t)).length;
    return { total, completed, inProgress, pending, overdue };
  }, [todos]);

  // 过滤后的待办列表
  const filteredTodos = useMemo(() => {
    let result = todos;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    if (filterCategory !== 'all') {
      result = result.filter((t) => t.category === filterCategory);
    }

    if (filterPriority !== 'all') {
      result = result.filter((t) => t.priority === filterPriority);
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'overdue') {
        result = result.filter((t) => isOverdue(t));
      } else {
        result = result.filter((t) => t.status === filterStatus);
      }
    }

    // 排序：未完成在前，按优先级排序，逾期优先
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const statusOrder = { 'in-progress': 0, pending: 1, completed: 2 };
    return result.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      const aOverdue = isOverdue(a) ? 0 : 1;
      const bOverdue = isOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }, [todos, searchQuery, filterCategory, filterPriority, filterStatus]);

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

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary font-display">
            <i className="fas fa-tasks text-accent-cyan mr-2" />
            个人工作台
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            管理你的待办事项、任务分类和完成进度
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-bg-primary transition-colors hover:bg-accent-cyan/80"
        >
          <i className="fas fa-plus" />
          <span className="hidden sm:inline">新建待办</span>
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="全部任务" value={stats.total} icon="fa-list" color="bg-accent-cyan/10 text-accent-cyan" />
        <StatCard label="待开始" value={stats.pending} icon="fa-circle" color="bg-accent-cyan/10 text-accent-cyan" />
        <StatCard label="进行中" value={stats.inProgress} icon="fa-spinner" color="bg-accent-orange/10 text-accent-orange" />
        <StatCard label="已完成" value={stats.completed} icon="fa-check-circle" color="bg-accent-green/10 text-accent-green" />
        <StatCard label="已逾期" value={stats.overdue} icon="fa-exclamation-circle" color="bg-accent-red/10 text-accent-red" />
      </div>

      {/* 完成率进度条 + 分类图表 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 完成率 */}
        <div className="rounded-lg border border-border-custom bg-bg-secondary p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-primary">
              <i className="fas fa-chart-line text-accent-cyan mr-2" />
              整体完成率
            </h3>
            <span className="text-2xl font-bold text-accent-cyan">{completionRate}%</span>
          </div>
          <div className="h-3 rounded-full bg-bg-tertiary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-green transition-all duration-700"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-text-muted">
            <span>已完成 {stats.completed} 项</span>
            <span>剩余 {stats.total - stats.completed} 项</span>
          </div>
        </div>

        {/* 分类统计 */}
        <CategoryChart todos={todos} />
      </div>

      {/* 搜索和过滤栏 */}
      <div className="flex flex-col gap-3">
        {/* 搜索框 */}
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索待办标题、描述或标签..."
            className="w-full rounded-lg border border-border-custom bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <i className="fas fa-times text-xs" />
            </button>
          )}
        </div>

        {/* 过滤器 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 状态过滤 */}
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
                  filterStatus === opt.v
                    ? 'bg-accent-cyan/15 text-accent-cyan'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border-custom" />

          {/* 优先级过滤 */}
          <div className="flex items-center gap-1">
            {[
              { v: 'all', l: '全部' },
              { v: 'high', l: '高' },
              { v: 'medium', l: '中' },
              { v: 'low', l: '低' },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setFilterPriority(opt.v)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  filterPriority === opt.v
                    ? 'bg-accent-cyan/15 text-accent-cyan'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>

          {allCategories.length > 0 && (
            <>
              <div className="h-4 w-px bg-border-custom" />

              {/* 分类过滤 */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                    filterCategory === 'all'
                      ? 'bg-accent-cyan/15 text-accent-cyan'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
                  }`}
                >
                  全部分类
                </button>
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                      filterCategory === cat
                        ? 'bg-accent-cyan/15 text-accent-cyan'
                        : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </>
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
              <button
                onClick={handleAdd}
                className="rounded-lg bg-accent-cyan/10 px-4 py-2 text-xs text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
              >
                <i className="fas fa-plus mr-1" />
                新建待办
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 结果计数 */}
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>共 {filteredTodos.length} 条结果</span>
              {(filterStatus !== 'all' || filterPriority !== 'all' || filterCategory !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('all');
                    setFilterPriority('all');
                    setFilterCategory('all');
                  }}
                  className="text-accent-cyan hover:underline"
                >
                  清除筛选
                </button>
              )}
            </div>

            {/* 卡片网格 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTodos.map((todo) => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  onToggle={() => toggleComplete(todo.id)}
                  onEdit={() => handleEdit(todo.id)}
                  onDelete={() => handleDelete(todo.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 编辑/新建弹窗 */}
      <TodoEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        todoId={editingId}
      />
    </div>
  );
}
