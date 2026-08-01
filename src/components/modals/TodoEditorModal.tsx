import { useEffect, useState, useCallback, useRef } from 'react';
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

/** ISO 字符串转 datetime-local 输入值 */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local 输入值转 ISO 字符串 */
function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** 将 File 转为 base64 data URL */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** 压缩图片：如果超过 500KB 则缩小到 maxDim */
function compressImage(dataUrl: string, maxDim = 1280, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        resolve(dataUrl);
        return;
      }
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
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
  const [reminderTime, setReminderTime] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setReminderTime(isoToLocalInput(existing.reminderTime));
        setImages(existing.images ?? []);
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
      setReminderTime('');
      setImages([]);
    }
  }, [open, todoId, todos]);

  /** 处理粘贴图片 */
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return;
    e.preventDefault();

    for (const file of imageFiles) {
      try {
        const dataUrl = await fileToDataUrl(file);
        const compressed = await compressImage(dataUrl);
        setImages((prev) => [...prev, compressed]);
      } catch {
        // 忽略单个文件失败
      }
    }
  }, []);

  /** 处理文件选择上传 */
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      try {
        const dataUrl = await fileToDataUrl(file);
        const compressed = await compressImage(dataUrl);
        setImages((prev) => [...prev, compressed]);
      } catch {
        // 忽略单个文件失败
      }
    }

    // 清空 input 以便重复选择同一文件
    e.target.value = '';
  }, []);

  /** 删除图片 */
  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** 预览图片（在新标签页打开） */
  const previewImage = useCallback((dataUrl: string) => {
    const w = window.open();
    if (w) {
      w.document.write(`<img src="${dataUrl}" style="max-width:100%;max-height:100vh;margin:auto;display:block;" />`);
      w.document.title = '图片预览';
    }
  }, []);

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
            reminderTime: localInputToIso(reminderTime),
            images,
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
          reminderTime: localInputToIso(reminderTime),
          images,
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-bg-secondary border-border-primary/30 text-text-primary" onPaste={handlePaste}>
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

          {/* 图片附件 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-muted">
                <i className="fas fa-image text-accent-cyan mr-1" />
                图片
                {images.length > 0 && <span className="text-text-muted ml-1">({images.length})</span>}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-md bg-accent-cyan/10 px-2 py-1 text-[10px] text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
              >
                <i className="fas fa-upload" />
                选择图片
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* 粘贴提示 */}
            {images.length === 0 && (
              <p className="text-[10px] text-text-muted">
                <i className="fas fa-info-circle mr-1" />
                可直接 Ctrl+V 粘贴截图，或点击"选择图片"上传
              </p>
            )}

            {/* 图片预览网格 */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border-custom bg-bg-primary"
                  >
                    <img
                      src={img}
                      alt={`图片 ${i + 1}`}
                      className="h-full w-full cursor-pointer object-cover transition-transform hover:scale-105"
                      onClick={() => previewImage(img)}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-accent-red group-hover:opacity-100"
                      title="删除图片"
                    >
                      <i className="fas fa-times text-[10px]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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

          {/* 定时提醒 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-muted">
                <i className="fas fa-bell text-accent-orange mr-1" />
                定时提醒
              </label>
              {reminderTime && (
                <button
                  type="button"
                  onClick={() => setReminderTime('')}
                  className="text-[10px] text-text-muted hover:text-accent-red transition-colors"
                >
                  清除提醒
                </button>
              )}
            </div>
            <input
              type="datetime-local"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
            {reminderTime && (
              <p className="text-[10px] text-text-muted">
                <i className="fas fa-info-circle mr-1" />
                将在 {new Date(reminderTime).toLocaleString('zh-CN')} 发送浏览器通知提醒
              </p>
            )}
            {'Notification' in window && Notification.permission === 'default' && (
              <button
                type="button"
                onClick={() => Notification.requestPermission()}
                className="flex items-center gap-1.5 rounded-lg bg-accent-orange/10 px-3 py-1.5 text-[11px] text-accent-orange hover:bg-accent-orange/20 transition-colors w-fit"
              >
                <i className="fas fa-bell" />
                启用浏览器通知
              </button>
            )}
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
