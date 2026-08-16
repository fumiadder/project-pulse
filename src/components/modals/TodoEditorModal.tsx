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
import { AutoResizeTextarea, type AutoResizeTextareaHandle } from '@/components/shared/AutoResizeTextarea';
import { ImageEditorModal } from '@/components/modals/ImageEditorModal';
import type { Todo, SubTask } from '@/types';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  type ReminderType,
  type ReminderConfig,
  parseReminderConfig,
  serializeReminderConfig,
  isoToLocalInput,
  localInputToIso,
} from '@/utils/reminder';

/** 艾森豪威尔矩阵分类（兼作优先级） */
const EISENHOWER_CATEGORIES = [
  { value: '紧急重要', label: '紧急重要', priority: 'high' as const, color: 'border-accent-red/50 bg-accent-red/10 text-accent-red', icon: 'fa-exclamation-circle' },
  { value: '重要不紧急', label: '重要不紧急', priority: 'medium' as const, color: 'border-accent-orange/50 bg-accent-orange/10 text-accent-orange', icon: 'fa-star' },
  { value: '紧急不重要', label: '紧急不重要', priority: 'medium' as const, color: 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan', icon: 'fa-bolt' },
  { value: '不重要不紧急', label: '不重要不紧急', priority: 'low' as const, color: 'border-text-muted/30 bg-bg-tertiary text-text-muted', icon: 'fa-minus-circle' },
] as const;

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

/* ============================================
   SortableSubtaskItem — 可拖拽排序的子任务行
   ============================================ */
interface SortableSubtaskItemProps {
  subtask: SubTask;
  isEditing: boolean;
  editingText: string;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isNoteEditing: boolean;
  noteText: string;
  noteColor: string;
  onNoteChange: (v: string) => void;
  onNoteColorChange: (v: string) => void;
  onSaveNote: () => void;
  onCancelNote: () => void;
  onStartNote: () => void;
}

/** 备注可选颜色列表 */
const NOTE_COLORS = [
  { value: '', label: '默认', css: 'text-text-muted/80' },
  { value: '#00d4ff', label: '青', css: 'text-[#00d4ff]' },
  { value: '#00ff88', label: '绿', css: 'text-[#00ff88]' },
  { value: '#ff8c00', label: '橙', css: 'text-[#ff8c00]' },
  { value: '#ff3366', label: '红', css: 'text-[#ff3366]' },
  { value: '#a855f7', label: '紫', css: 'text-[#a855f7]' },
  { value: '#f1f5f9', label: '白', css: 'text-[#f1f5f9]' },
  { value: '#fbbf24', label: '黄', css: 'text-[#fbbf24]' },
];

function SortableSubtaskItem({
  subtask: st,
  isEditing,
  editingText,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onToggle,
  onDelete,
  isNoteEditing,
  noteText,
  noteColor,
  onNoteChange,
  onNoteColorChange,
  onSaveNote,
  onCancelNote,
  onStartNote,
}: SortableSubtaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: st.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex flex-col gap-1 rounded-lg bg-bg-primary/60 px-2.5 py-2 ${
        isDragging ? 'z-50 opacity-60 shadow-lg ring-1 ring-accent-cyan/40' : ''
      }`}
      {...attributes}
    >
      <div className="flex items-center gap-2">
        {/* 拖拽手柄 */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          className="flex h-4 w-3 shrink-0 cursor-grab items-center justify-center text-text-muted/40 hover:text-text-secondary active:cursor-grabbing"
          title="拖拽排序"
        >
          <i className="fas fa-grip-vertical text-[10px]" />
        </button>

        {/* 完成状态复选框 */}
        <button
          type="button"
          onClick={onToggle}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[8px] transition-all ${
            st.done
              ? 'border-accent-green bg-accent-green/20 text-accent-green'
              : 'border-border-hover text-transparent hover:border-accent-cyan'
          }`}
        >
          {st.done && <i className="fas fa-check" />}
        </button>

        {/* 标题 / 编辑输入框 */}
        {isEditing ? (
          <input
            type="text"
            value={editingText}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onSaveEdit(); }
              else if (e.key === 'Escape') { e.preventDefault(); onCancelEdit(); }
            }}
            autoFocus
            className="flex-1 rounded-md border border-accent-cyan/40 bg-bg-primary px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-cyan/50"
          />
        ) : (
          <span
            className={`flex-1 text-xs cursor-text ${st.done ? 'line-through text-text-muted' : 'text-text-primary'}`}
            onDoubleClick={onStartEdit}
            title="双击编辑"
          >
            {st.title}
          </span>
        )}

        {/* 操作按钮 */}
        {isEditing ? (
          <>
            <button type="button" onClick={onSaveEdit} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-accent-green hover:bg-accent-green/10" title="保存">
              <i className="fas fa-check text-[10px]" />
            </button>
            <button type="button" onClick={onCancelEdit} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title="取消">
              <i className="fas fa-times text-[10px]" />
            </button>
          </>
        ) : (
          <>
            <span className="text-[9px] text-text-muted shrink-0">
              {st.done ? '已完成' : '待完成'}
            </span>
            <button type="button" onClick={onStartNote} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-all hover:bg-accent-purple/10 hover:text-accent-purple group-hover:opacity-100" title="备注">
              <i className="fas fa-comment-dots text-[9px]" />
            </button>
            <button type="button" onClick={onStartEdit} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-all hover:bg-accent-cyan/10 hover:text-accent-cyan group-hover:opacity-100" title="编辑">
              <i className="fas fa-pen text-[9px]" />
            </button>
            <button type="button" onClick={onDelete} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-all hover:bg-accent-red/10 hover:text-accent-red group-hover:opacity-100" title="删除">
              <i className="fas fa-times text-[10px]" />
            </button>
          </>
        )}
      </div>

      {/* 备注编辑 */}
      {isNoteEditing && (
        <div className="flex flex-col gap-1.5 pl-6">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={noteText}
              onChange={(e) => onNoteChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onSaveNote(); }
                else if (e.key === 'Escape') { e.preventDefault(); onCancelNote(); }
              }}
              autoFocus
              placeholder="输入备注..."
              className="flex-1 rounded-md border border-accent-purple/40 bg-bg-primary px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-accent-purple/50"
              style={{ color: noteColor || undefined }}
            />
            <button type="button" onClick={onSaveNote} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-accent-green hover:bg-accent-green/10" title="保存备注">
              <i className="fas fa-check text-[10px]" />
            </button>
            <button type="button" onClick={onCancelNote} className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted hover:bg-bg-tertiary hover:text-text-primary" title="取消">
              <i className="fas fa-times text-[10px]" />
            </button>
          </div>
          {/* 颜色选择器 */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-text-muted shrink-0">颜色</span>
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => onNoteColorChange(c.value)}
                className={`h-4 w-4 shrink-0 rounded-full border transition-all ${
                  noteColor === c.value
                    ? 'border-text-primary scale-125 ring-1 ring-text-primary/30'
                    : 'border-border-hover hover:scale-110'
                }`}
                style={{ backgroundColor: c.value || 'transparent' }}
                title={c.label}
              >
                {!c.value && <i className="fas fa-font text-[7px] text-text-muted" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 备注展示 */}
      {!isNoteEditing && st.note && (
        <div className="flex items-start gap-1 pl-6">
          <i className="fas fa-comment-dots text-[8px] mt-0.5 shrink-0" style={{ color: st.noteColor || 'var(--accent-purple)' }} />
          <span className="text-[10px]" style={{ color: st.noteColor || undefined }}>{st.note}</span>
        </div>
      )}
    </div>
  );
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
  const [category, setCategory] = useState<string>('重要不紧急');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<Todo['status']>('pending');
  const [dueDate, setDueDate] = useState('');
  // 提醒配置状态
  const [reminderType, setReminderType] = useState<ReminderType>('none');
  const [reminderOnceDate, setReminderOnceDate] = useState('');       // datetime-local
  const [reminderDailyTime, setReminderDailyTime] = useState('09:00'); // HH:MM
  const [intervalValue, setIntervalValue] = useState(30);              // 数值
  const [intervalUnit, setIntervalUnit] = useState<'minutes' | 'hours'>('minutes');
  const [images, setImages] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskText, setEditingSubtaskText] = useState('');
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [noteEditingText, setNoteEditingText] = useState('');
  const [noteEditingColor, setNoteEditingColor] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const descriptionRef = useRef<AutoResizeTextareaHandle>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isEditing = !!todoId;

  /** 从 description HTML 中提取所有图片 src，确保 images 数组与描述一致 */
  function extractImagesFromHtml(html: string): string[] {
    try {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const imgs = temp.querySelectorAll('img');
      return Array.from(imgs).map((img) => img.getAttribute('src') || img.src).filter(Boolean);
    } catch {
      return [];
    }
  }

  /** 添加子任务 */
  const handleAddSubtask = useCallback(() => {
    if (!newSubtaskText.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: newSubtaskText.trim(),
        done: false,
      },
    ]);
    setNewSubtaskText('');
  }, [newSubtaskText]);

  /** 切换子任务完成状态 */
  const handleToggleSubtask = useCallback((id: string) => {
    setSubtasks((prev) => prev.map((st) => (st.id === id ? { ...st, done: !st.done } : st)));
  }, []);

  /** 删除子任务 */
  const handleDeleteSubtask = useCallback((id: string) => {
    setSubtasks((prev) => prev.filter((st) => st.id !== id));
    if (editingSubtaskId === id) {
      setEditingSubtaskId(null);
      setEditingSubtaskText('');
    }
  }, [editingSubtaskId]);

  /** 进入子任务编辑模式 */
  const handleStartEditSubtask = useCallback((id: string, currentTitle: string) => {
    setEditingSubtaskId(id);
    setEditingSubtaskText(currentTitle);
  }, []);

  /** 保存子任务编辑 */
  const handleSaveEditSubtask = useCallback(() => {
    if (!editingSubtaskId) return;
    const trimmed = editingSubtaskText.trim();
    if (trimmed) {
      setSubtasks((prev) => prev.map((st) => (st.id === editingSubtaskId ? { ...st, title: trimmed } : st)));
    }
    setEditingSubtaskId(null);
    setEditingSubtaskText('');
  }, [editingSubtaskId, editingSubtaskText]);

  /** 取消子任务编辑 */
  const handleCancelEditSubtask = useCallback(() => {
    setEditingSubtaskId(null);
    setEditingSubtaskText('');
  }, []);

  /** 拖拽排序：传感器配置 */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /** 拖拽排序结束 */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSubtasks((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  /** 保存子任务备注 */
  const handleSaveNote = useCallback(() => {
    if (!noteEditingId) return;
    setSubtasks((prev) => prev.map((st) =>
      st.id === noteEditingId
        ? { ...st, note: noteEditingText.trim() || undefined, noteColor: noteEditingColor || undefined }
        : st
    ));
    setNoteEditingId(null);
    setNoteEditingText('');
    setNoteEditingColor('');
  }, [noteEditingId, noteEditingText, noteEditingColor]);

  /** 取消子任务备注编辑 */
  const handleCancelNote = useCallback(() => {
    setNoteEditingId(null);
    setNoteEditingText('');
    setNoteEditingColor('');
  }, []);

  // 打开时初始化表单
  useEffect(() => {
    if (!open) return;
    setSaveError(null);

    if (todoId) {
      const existing = todos.find((t) => t.id === todoId);
      if (existing) {
        setTitle(existing.title);
        setDescription(existing.description);
        // 兼容旧分类：如果旧分类不在艾森豪威尔矩阵中，映射到最接近的
        const isEisenhower = EISENHOWER_CATEGORIES.some(c => c.value === existing.category);
        setCategory(isEisenhower ? existing.category : '重要不紧急');
        setTagsInput(existing.tags.join(', '));
        setStatus(existing.status);
        setDueDate(existing.dueDate ?? '');
        // 解析提醒配置
        const rc = parseReminderConfig(existing.reminderTime);
        setReminderType(rc.type);
        setReminderOnceDate(rc.type === 'once' ? isoToLocalInput(rc.datetime) : '');
        setReminderDailyTime(rc.type === 'daily' ? (rc.time || '09:00') : '09:00');
        if (rc.type === 'interval' && rc.intervalMinutes) {
          const mins = rc.intervalMinutes;
          if (mins >= 60 && mins % 60 === 0) {
            setIntervalValue(mins / 60);
            setIntervalUnit('hours');
          } else {
            setIntervalValue(mins);
            setIntervalUnit('minutes');
          }
        } else {
          setIntervalValue(30);
          setIntervalUnit('minutes');
        }
        setImages(existing.images ?? []);
        setSubtasks(existing.subtasks ?? []);
      }
    } else {
      setTitle('');
      setDescription('');
      setCategory('重要不紧急');
      setTagsInput('');
      setStatus('pending');
      setDueDate('');
      setReminderType('none');
      setReminderOnceDate('');
      setReminderDailyTime('09:00');
      setIntervalValue(30);
      setIntervalUnit('minutes');
      setImages([]);
      setSubtasks([]);
    }
  }, [open, todoId, todos]);

  /** 粘贴文件时：压缩并添加到 images 数组（用于卡片缩略图） */
  const handlePasteFiles = useCallback(async (files: FileList) => {
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
  }, []);

  /** AutoResizeTextarea 内联插入图片前先压缩（不再重复添加到 images 数组，
   *  由 handlePasteFiles 统一负责管理 images） */
  const handleProcessImage = useCallback(async (dataUrl: string): Promise<string> => {
    return await compressImage(dataUrl);
  }, []);

  /** 点击内联图片预览 */
  const handleImageClick = useCallback((src: string) => {
    // 先同步编辑器内容，确保 description 状态与 DOM 一致
    descriptionRef.current?.syncContent();
    setPreviewImage(src);
  }, []);

  /** 图片编辑后更新（框选删除/裁剪） */
  const handleUpdateImage = useCallback((oldSrc: string, newSrc: string) => {
    // 更新 description HTML 中的图片 src（双重匹配防止浏览器规范化差异）
    setDescription((prev) => {
      const temp = document.createElement('div');
      temp.innerHTML = prev;
      temp.querySelectorAll('img').forEach((img) => {
        if (img.getAttribute('src') === oldSrc || img.src === oldSrc) {
          img.setAttribute('src', newSrc);
        }
      });
      return temp.innerHTML;
    });
    // 更新 images 数组
    setImages((prev) => prev.map((img) => (img === oldSrc ? newSrc : img)));
    // 更新预览状态
    setPreviewImage(newSrc);
  }, []);

  /** 删除整张图片 */
  const handleDeleteImage = useCallback((src: string) => {
    // 从 description HTML 中移除对应的 img 标签
    // 同时匹配 getAttribute('src') 和 img.src，防止浏览器规范化导致不匹配
    setDescription((prev) => {
      const temp = document.createElement('div');
      temp.innerHTML = prev;
      temp.querySelectorAll('img').forEach((img) => {
        if (img.getAttribute('src') === src || img.src === src) {
          img.remove();
        }
      });
      return temp.innerHTML;
    });
    // 从 images 数组中移除（兼容 src 可能经过裁剪/删除选区后变化的情况）
    setImages((prev) => prev.filter((img) => img !== src));
    // 关闭预览弹窗
    setPreviewImage(null);
  }, []);

  const handleSave = async () => {
    if (!title.trim()) return;
    // 保存前强制同步编辑器内容（防止 IME composing 未完成导致内容丢失）
    descriptionRef.current?.syncContent();
    setSaveError(null);
    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      // 从艾森豪威尔分类推导优先级
      const eisenhowerItem = EISENHOWER_CATEGORIES.find(c => c.value === category);
      const priority = eisenhowerItem?.priority ?? 'medium';
      const tags = tagsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // 构建提醒配置
      let config: ReminderConfig = { type: 'none' };
      if (reminderType === 'once' && reminderOnceDate) {
        config = { type: 'once', datetime: localInputToIso(reminderOnceDate) };
      } else if (reminderType === 'daily' && reminderDailyTime) {
        config = { type: 'daily', time: reminderDailyTime };
      } else if (reminderType === 'interval' && intervalValue > 0) {
        const mins = intervalUnit === 'hours' ? intervalValue * 60 : intervalValue;
        config = { type: 'interval', intervalMinutes: mins };
      }
      const serializedReminder = serializeReminderConfig(config);

      // ★ 关键修复：从 DOM 直接读取最新的描述内容，避免闭包中 description 过期
      // syncContent 已将 DOM 同步给 onChange(setDescription)，但 handleSave
      // 闭包中的 description 变量仍是旧值。这里直接从编辑器读取确保一致。
      const editorEl = descriptionRef.current as any;
      let latestDescription = description;
      if (editorEl && typeof editorEl.getInnerHTML === 'function') {
        latestDescription = editorEl.getInnerHTML();
      }

      // ★ 关键修复：从描述 HTML 中重新提取图片列表，确保 images 数组
      // 与描述内容完全一致（删除图片后 images 自动同步）
      const syncedImages = extractImagesFromHtml(latestDescription);

      if (isEditing && todoId) {
        const existing = todos.find((t) => t.id === todoId);
        if (existing) {
          const updated: Todo = {
            ...existing,
            title: title.trim(),
            description: latestDescription,
            category,
            tags,
            priority,
            status,
            dueDate: dueDate || null,
            reminderTime: serializedReminder,
            images: syncedImages,
            subtasks,
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
          description: latestDescription,
          category,
          tags,
          priority,
          status,
          dueDate: dueDate || null,
          reminderTime: serializedReminder,
          images: syncedImages,
          subtasks,
          pinned: false,
          completedAt: status === 'completed' ? now : null,
          createdAt: now,
          updatedAt: now,
        };
        await addTodo(newTodo);
      }

      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败，请重试');
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

          {/* 描述（支持内联粘贴图片） */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">
              描述
              <span className="text-text-muted/60 ml-1">（可直接 Ctrl+V 粘贴图片）</span>
            </label>
            <AutoResizeTextarea
              ref={descriptionRef}
              value={description}
              onChange={(v) => setDescription(v)}
              onPasteFiles={handlePasteFiles}
              onProcessImage={handleProcessImage}
              onImageClick={(src) => handleImageClick(src)}
              placeholder="输入详细描述，支持粘贴图片..."
              minRows={4}
            />
          </div>

          {/* 子任务 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">
              <i className="fas fa-list-check text-accent-cyan mr-1" />
              子任务
              <span className="text-text-muted/60 ml-1">（细化步骤，自动计算进度）</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="添加子任务，回车确认..."
                className="flex-1 rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
              <Button
                onClick={handleAddSubtask}
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={!newSubtaskText.trim()}
              >
                <i className="fas fa-plus text-xs" />
              </Button>
            </div>
            {subtasks.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1.5">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    {subtasks.map((st) => (
                      <SortableSubtaskItem
                        key={st.id}
                        subtask={st}
                        isEditing={editingSubtaskId === st.id}
                        editingText={editingSubtaskId === st.id ? editingSubtaskText : ''}
                        onEditChange={setEditingSubtaskText}
                        onSaveEdit={handleSaveEditSubtask}
                        onCancelEdit={handleCancelEditSubtask}
                        onStartEdit={() => handleStartEditSubtask(st.id, st.title)}
                        onToggle={() => handleToggleSubtask(st.id)}
                        onDelete={() => handleDeleteSubtask(st.id)}
                        isNoteEditing={noteEditingId === st.id}
                        noteText={noteEditingId === st.id ? noteEditingText : ''}
                        noteColor={noteEditingId === st.id ? noteEditingColor : ''}
                        onNoteChange={setNoteEditingText}
                        onNoteColorChange={setNoteEditingColor}
                        onSaveNote={handleSaveNote}
                        onCancelNote={handleCancelNote}
                        onStartNote={() => { setNoteEditingId(st.id); setNoteEditingText(st.note ?? ''); setNoteEditingColor(st.noteColor ?? ''); }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                {/* 总进度统计 */}
                <div className="flex items-center justify-between text-[10px] text-text-muted px-1">
                  <span>
                    <i className="fas fa-chart-simple mr-1" />
                    {subtasks.filter((s) => s.done).length}/{subtasks.length} 已完成
                  </span>
                  <span>
                    进度 {Math.round((subtasks.filter((s) => s.done).length / subtasks.length) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 艾森豪威尔分类（兼作优先级） */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">
              <i className="fas fa-layer-group text-accent-cyan mr-1" />
              优先级分类
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EISENHOWER_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    category === cat.value
                      ? cat.color
                      : 'border-border-primary/30 text-text-secondary hover:border-border-hover hover:text-text-primary'
                  }`}
                >
                  <i className={`fas ${cat.icon} text-[10px]`} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 标签 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">标签</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="多个标签用逗号分隔，如：前端, 优化"
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
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
            <label className="text-xs font-medium text-text-muted">
              <i className="fas fa-bell text-accent-orange mr-1" />
              定时提醒
            </label>

            {/* 提醒类型选择 */}
            <div className="flex gap-1.5">
              {([
                { v: 'none' as const, l: '不提醒', icon: 'fa-bell-slash' },
                { v: 'once' as const, l: '指定时间', icon: 'fa-clock' },
                { v: 'daily' as const, l: '每天', icon: 'fa-calendar-day' },
                { v: 'interval' as const, l: '每隔', icon: 'fa-redo' },
              ]).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setReminderType(opt.v)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    reminderType === opt.v
                      ? 'border-accent-orange/50 bg-accent-orange/10 text-accent-orange'
                      : 'border-border-primary/30 text-text-secondary hover:text-text-primary hover:border-border-hover'
                  }`}
                >
                  <i className={`fas ${opt.icon} mr-1`} />
                  {opt.l}
                </button>
              ))}
            </div>

            {/* 指定时间：日期+时间选择器 */}
            {reminderType === 'once' && (
              <input
                type="datetime-local"
                value={reminderOnceDate}
                onChange={(e) => setReminderOnceDate(e.target.value)}
                className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            )}

            {/* 每天：时间选择器 */}
            {reminderType === 'daily' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">每天</span>
                <input
                  type="time"
                  value={reminderDailyTime}
                  onChange={(e) => setReminderDailyTime(e.target.value)}
                  className="rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                />
                <span className="text-xs text-text-secondary">提醒</span>
              </div>
            )}

            {/* 每隔：数值+单位 */}
            {reminderType === 'interval' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">每隔</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                />
                <div className="flex gap-1">
                  {(['minutes', 'hours'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setIntervalUnit(u)}
                      className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                        intervalUnit === u
                          ? 'bg-accent-orange/15 text-accent-orange'
                          : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
                      }`}
                    >
                      {u === 'minutes' ? '分钟' : '小时'}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-text-secondary">提醒一次</span>
              </div>
            )}

            {/* 提醒预览描述 */}
            {reminderType !== 'none' && (() => {
              let preview = '';
              if (reminderType === 'once' && reminderOnceDate) {
                const d = new Date(reminderOnceDate);
                if (!isNaN(d.getTime())) {
                  preview = `将在 ${d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 提醒`;
                }
              } else if (reminderType === 'daily' && reminderDailyTime) {
                preview = `每天 ${reminderDailyTime} 提醒`;
              } else if (reminderType === 'interval' && intervalValue > 0) {
                const unitLabel = intervalUnit === 'hours' ? '小时' : '分钟';
                preview = `每隔 ${intervalValue} ${unitLabel}提醒一次`;
              }
              return preview ? (
                <p className="text-[10px] text-accent-orange/80">
                  <i className="fas fa-info-circle mr-1" />
                  {preview}
                </p>
              ) : null;
            })()}

            {'Notification' in window && Notification.permission === 'default' && reminderType !== 'none' && (
              <button
                type="button"
                onClick={() => Notification.requestPermission()}
                className="flex items-center gap-1.5 rounded-lg bg-accent-orange/10 px-3 py-1.5 text-[11px] text-accent-orange hover:bg-accent-orange/20 transition-colors w-fit"
              >
                <i className="fas fa-bell" />
                启用浏览器通知（同时支持页面内弹窗提醒）
              </button>
            )}
            {reminderType !== 'none' && (
              <p className="text-[10px] text-text-muted">
                <i className="fas fa-info-circle mr-1" />
                提醒将在页面打开时通过弹窗通知{Notification.permission === 'granted' ? '和浏览器通知' : ''}发送
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {saveError && (
            <p className="mr-auto text-xs text-accent-red flex items-center gap-1">
              <i className="fas fa-exclamation-circle" />
              {saveError}
            </p>
          )}
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

      {/* 图片编辑弹窗（支持框选删除/裁剪） */}
      {previewImage && (
        <ImageEditorModal
          src={previewImage}
          mode="view"
          onClose={() => setPreviewImage(null)}
          onUpdateImage={handleUpdateImage}
          onDeleteImage={handleDeleteImage}
        />
      )}
    </Dialog>
  );
}
