import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTodoStore } from '@/stores/useTodoStore';
import { useUserStore } from '@/stores/useUserStore';
import type { Todo } from '@/types';

/** 预设分类 */
const CATEGORIES = ['工作', '学习', '生活', '健康', '其他'] as const;

/** 优先级配置 */
const PRIORITY_OPTIONS = [
  { value: 'high' as const, label: '高', color: 'text-accent-red border-accent-red/50 bg-accent-red/10' },
  { value: 'medium' as const, label: '中', color: 'text-accent-orange border-accent-orange/50 bg-accent-orange/10' },
  { value: 'low' as const, label: '低', color: 'text-accent-cyan border-accent-cyan/50 bg-accent-cyan/10' },
];

/** 状态配置 */
const STATUS_OPTIONS = [
  { value: 'pending' as const, label: '待开始' },
  { value: 'in-progress' as const, label: '进行中' },
  { value: 'completed' as const, label: '已完成' },
];

/** 生成唯一 ID */
function generateId(): string {
  return `todo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface TodoEditorModalProps {
  open: boolean;
  onClose: () => void;
  todoId?: string | null;
}

export function TodoEditorModal({ open, onClose, todoId }: TodoEditorModalProps) {
  const { todos, addTodo, updateTodo } = useTodoStore();
  const { currentUser } = useUserStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('工作');
  const [customCategory, setCustomCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [priority, setPriority] = useState<Todo['priority']>('medium');
  const [status, setStatus] = useState<Todo['status']>('pending');
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!todoId;

  // 打开时初始化表单
  useEffect(() => {
    if (!open) return;

    if (todoId) {
      const existing = todos.find((t) => t.id === todoId);
      if (existing) {
        setTitle(existing.title);
        setDescription(existing.description);
        setCategory(CATEGORIES.includes(existing.category as any) ? existing.category : '其他');
        setCustomCategory(CATEGORIES.includes(existing.category as any) ? '' : existing.category);
        setTagsInput(existing.tags.join(', '));
        setPriority(existing.priority);
        setStatus(existing.status);
        setDueDate(existing.dueDate ?? '');
      }
    } else {
      setTitle('');
      setDescription('');
      setCategory('工作');
      setCustomCategory('');
      setTagsInput('');
      setPriority('medium');
      setStatus('pending');
      setDueDate('');
    }
  }, [open, todoId, todos]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const finalCategory = category === '其他' && customCategory.trim() ? customCategory.trim() : category;
      const tags = tagsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (isEditing && todoId) {
        const existing = todos.find((t) => t.id === todoId);
        if (existing) {
          const updated: Todo = {
            ...existing,
            title: title.trim(),
            description: description.trim(),
            category: finalCategory,
            tags,
            priority,
            status,
            dueDate: dueDate || null,
            completedAt: status === 'completed' ? (existing.completedAt ?? now) : null,
            updatedAt: now,
          };
          await updateTodo(updated);
        }
      } else {
        const newTodo: Todo = {
          id: generateId(),
          userId: currentUser?.id ?? '',
          title: title.trim(),
          description: description.trim(),
          category: finalCategory,
          tags,
          priority,
          status,
          dueDate: dueDate || null,
          completedAt: status === 'completed' ? now : null,
          createdAt: now,
          updatedAt: now,
        };
        await addTodo(newTodo);
      }

      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-bg-secondary border-border-primary/30 text-text-primary">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            {isEditing ? '编辑待办' : '新建待办'}
          </DialogTitle>
          <DialogDescription className="text-text-muted">
            {isEditing ? '修改待办事项' : '创建新的待办事项'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 标题 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入待办标题..."
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              autoFocus
            />
          </div>

          {/* 描述 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="详细描述（可选）..."
              rows={3}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 resize-none"
            />
          </div>

          {/* 分类 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">分类</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setCategory(cat); if (cat !== '其他') setCustomCategory(''); }}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    category === cat
                      ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan'
                      : 'border-border-primary/30 text-text-secondary hover:border-border-hover hover:text-text-primary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {category === '其他' && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="输入自定义分类名称..."
                className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            )}
          </div>

          {/* 标签 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">标签</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="多个标签用逗号分隔，如：紧急, 前端, 优化"
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
          </div>

          {/* 优先级 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">优先级</label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    priority === opt.value
                      ? opt.color
                      : 'border-border-primary/30 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 进度状态 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">进度</label>
            {/* 进度可视化预览 */}
            <div className="flex items-center gap-2 rounded-lg bg-bg-primary px-3 py-2">
              <div className="h-2 flex-1 rounded-full bg-bg-tertiary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    status === 'completed' ? 'bg-accent-green' : status === 'in-progress' ? 'bg-accent-orange' : 'bg-text-muted/30'
                  }`}
                  style={{ width: `${status === 'completed' ? 100 : status === 'in-progress' ? 50 : 0}%` }}
                />
              </div>
              <span className={`text-xs font-bold ${
                status === 'completed' ? 'text-accent-green' : status === 'in-progress' ? 'text-accent-orange' : 'text-text-muted'
              }`}>
                {status === 'completed' ? '100%' : status === 'in-progress' ? '50%' : '0%'}
              </span>
            </div>
            {/* 状态选择按钮 */}
            <div className="flex gap-2 mt-1">
              {STATUS_OPTIONS.map((opt) => {
                const isActive = status === opt.value;
                const activeColor = opt.value === 'completed'
                  ? 'border-accent-green/50 bg-accent-green/10 text-accent-green'
                  : opt.value === 'in-progress'
                  ? 'border-accent-orange/50 bg-accent-orange/10 text-accent-orange'
                  : 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan';
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      isActive ? activeColor : 'border-border-primary/30 text-text-secondary hover:text-text-primary hover:border-border-hover'
                    }`}
                  >
                    <i className={`fas ${
                      opt.value === 'completed' ? 'fa-check-circle' :
                      opt.value === 'in-progress' ? 'fa-spinner' : 'fa-circle'
                    } mr-1.5`} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 截止日期 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">截止日期</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="text-text-secondary">
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="bg-accent-cyan text-bg-primary hover:bg-accent-cyan/80"
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
