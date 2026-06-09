import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useProgressStore } from '@/stores/useProgressStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import type { Progress, Attachment } from '@/types';

/** Status options */
const STATUS_OPTIONS = [
  { value: 'normal', label: '正常' },
  { value: 'warning', label: '有风险' },
  { value: 'danger', label: '延期' },
  { value: 'info', label: '信息' },
];

/** Generate a simple unique ID */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Get today's date as YYYY-MM-DD */
function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get today's ISO string */
function getTodayISO(): string {
  return new Date().toISOString();
}

interface ProgressEditorModalProps {
  open: boolean;
  onClose: () => void;
  progressId?: string | null;
  preDate?: string;
  preProjectId?: string;
}

export function ProgressEditorModal({
  open,
  onClose,
  progressId,
  preDate,
  preProjectId,
}: ProgressEditorModalProps) {
  const { entries, addEntry, updateEntry } = useProgressStore();
  const { projects } = useProjectStore();
  const { currentUser } = useUserStore();

  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState('');
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState<string>('normal');
  const [content, setContent] = useState('');
  const [plan, setPlan] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!progressId;

  // Filter projects for current user
  const myProjects = currentUser
    ? projects.filter((p) => p.owner === currentUser.name)
    : projects;

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;

    if (progressId) {
      const existing = entries.find((e) => e.id === progressId);
      if (existing) {
        setProjectId(existing.projectId);
        setDate(existing.date);
        setPercent(existing.percent);
        setStatus(existing.status);
        setContent(existing.content);
        setPlan(existing.plan);
        setAttachments(existing.attachments || []);
      }
    } else {
      setProjectId(preProjectId ?? '');
      setDate(preDate ?? getTodayStr());
      setPercent(0);
      setStatus('normal');
      setContent('');
      setPlan('');
      setAttachments([]);
    }
  }, [open, progressId, entries, preDate, preProjectId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const isImage = file.type.startsWith('image/');
        const newAttachment: Attachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          data: dataUrl,
          isImage,
        };
        setAttachments((prev) => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSave = async () => {
    if (!content.trim() || !projectId) return;
    setIsSaving(true);

    try {
      const now = getTodayISO();

      if (isEditing && progressId) {
        const existing = entries.find((e) => e.id === progressId);
        if (existing) {
          const updated: Progress = {
            ...existing,
            projectId,
            date,
            percent,
            status: status as Progress['status'],
            content: content.trim(),
            plan: plan.trim(),
            attachments,
            updatedAt: now,
          };
          await updateEntry(updated);
        }
      } else {
        const newEntry: Progress = {
          id: generateId(),
          userId: currentUser?.id ?? '',
          projectId,
          date,
          percent,
          status: status as Progress['status'],
          content: content.trim(),
          plan: plan.trim(),
          attachments,
          createdAt: now,
          updatedAt: now,
        };
        await addEntry(newEntry);
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
            {isEditing ? '编辑进度' : '新建进度'}
          </DialogTitle>
          <DialogDescription className="text-text-muted">
            {isEditing ? '修改进度记录' : '为项目添加新的进度记录'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Project Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">项目 *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            >
              <option value="">请选择项目</option>
              {myProjects.map((p) => {
                const parent = projects.find((pp) => pp.id === p.parentId);
                const label = parent ? `${parent.name} > ${p.name}` : p.name;
                return (
                  <option key={p.id} value={p.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
          </div>

          {/* Percent Slider */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">进度: {percent}%</label>
            <div className="flex items-center gap-3">
              <Slider
                value={[percent]}
                onValueChange={(val) => setPercent(val[0])}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={percent}
                onChange={(e) => {
                  const v = Math.min(100, Math.max(0, Number(e.target.value)));
                  setPercent(v);
                }}
                className="w-16 rounded-lg border border-border-primary/30 bg-bg-primary px-2 py-1 text-sm text-text-primary text-center focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">内容 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入进度内容"
              rows={4}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 resize-y focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
          </div>

          {/* Plan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">计划</label>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="输入下一步计划"
              rows={3}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 resize-y focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
          </div>

          {/* File Upload */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">附件</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-primary/30 bg-bg-primary/50 px-4 py-3 cursor-pointer transition-all hover:border-accent-cyan/40 hover:bg-accent-cyan/5"
            >
              <i className="fas fa-cloud-upload-alt text-accent-cyan" />
              <span className="text-xs text-text-muted">点击上传附件</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((att) => (
                  <div key={att.id} className="relative group">
                    {att.isImage ? (
                      <img
                        src={att.data}
                        alt={att.name}
                        className="h-16 w-16 rounded-lg object-cover border border-border-primary/30"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border-primary/30 bg-bg-secondary">
                        <i className="fas fa-file text-text-muted text-lg" />
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-red text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <i className="fas fa-times" />
                    </button>
                    <p className="text-[10px] text-text-muted mt-0.5 truncate max-w-[64px]">
                      {att.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-border-primary/30 bg-bg-primary px-4 py-2 text-xs font-medium text-text-secondary transition-all hover:bg-bg-tertiary disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !content.trim() || !projectId}
            className="rounded-lg bg-accent-cyan px-4 py-2 text-xs font-medium text-white transition-all hover:bg-accent-cyan/80 disabled:opacity-50"
          >
            {isSaving ? '保存中...' : isEditing ? '更新' : '创建'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
