import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import type { Project } from '@/types';

/** Preset color options for project color picker */
const PRESET_COLORS = [
  '#00d4ff', '#00e5a0', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48',
];

/** Priority options */
const PRIORITY_OPTIONS = [
  { value: '高', label: '高' },
  { value: '中', label: '中' },
  { value: '低', label: '低' },
];

/** 状态选项：未开始、进行中、有风险、延期 */
const STATUS_OPTIONS = [
  { value: '未开始', label: '未开始' },
  { value: '进行中', label: '进行中' },
  { value: '有风险', label: '有风险' },
  { value: '延期', label: '延期' },
];

/** Generate a simple unique ID */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Get today's ISO string */
function getTodayISO(): string {
  return new Date().toISOString();
}

interface ProjectEditorModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string | null;
  parentId?: string | null;
}

export function ProjectEditorModal({
  open,
  onClose,
  projectId,
  parentId,
}: ProjectEditorModalProps) {
  const { projects, addProject, updateProject } = useProjectStore();
  const { currentUser, users } = useUserStore();

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [owner, setOwner] = useState('');
  const [color, setColor] = useState('#00d4ff');
  const [priority, setPriority] = useState('中');
  const [status, setStatus] = useState('进行中');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!projectId;
  const parentProject = parentId
    ? projects.find((p) => p.id === parentId)
    : null;

  // Reset form when modal opens or projectId changes
  useEffect(() => {
    if (!open) return;

    if (projectId) {
      const existing = projects.find((p) => p.id === projectId);
      if (existing) {
        setName(existing.name);
        setDesc(existing.desc);
        setOwner(existing.owner);
        setColor(existing.color);
        setPriority(existing.priority);
        setStatus(existing.status);
        setStartDate(existing.startDate);
        setEndDate(existing.endDate);
        setNotes(existing.notes);
      }
    } else {
      setName('');
      setDesc('');
      setOwner(currentUser?.name ?? '');
      setColor('#00d4ff');
      setPriority('中');
      setStatus('进行中');
      setStartDate('');
      setEndDate('');
      setNotes('');
    }
  }, [open, projectId, projects, currentUser]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);

    try {
      const now = getTodayISO();

      if (isEditing && projectId) {
        const existing = projects.find((p) => p.id === projectId);
        if (existing) {
          const updated: Project = {
            ...existing,
            name: name.trim(),
            desc: desc.trim(),
            owner,
            color,
            priority,
            status,
            startDate,
            endDate,
            notes: notes.trim(),
            updatedAt: now,
          };
          await updateProject(updated);
        }
      } else {
        const newProject: Project = {
          id: generateId(),
          userId: currentUser?.id ?? '',
          parentId: parentId ?? null,
          name: name.trim(),
          desc: desc.trim(),
          owner,
          color,
          priority,
          status,
          startDate,
          endDate,
          collaborators: '',
          notes: notes.trim(),
          createdAt: now,
          updatedAt: now,
        };
        await addProject(newProject);
      }

      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败，请重试';
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-bg-secondary border-border-primary/30 text-text-primary">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            {isEditing ? '编辑项目' : (parentId ? '添加子项目' : '新建大项目')}
          </DialogTitle>
          <DialogDescription className="text-text-muted">
            {isEditing
              ? '修改项目信息'
              : parentId
                ? `在「${parentProject?.name ?? ''}」下创建子项目`
                : '创建一个新的顶级项目'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入项目名称"
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">描述</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="输入项目描述"
              rows={3}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 resize-y focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
          </div>

          {/* Owner */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">负责人</label>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            >
              <option value="">请选择</option>
              {users.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Color Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">颜色</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    color === c
                      ? 'border-white scale-110 shadow-lg'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Priority & Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">优先级</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
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
          </div>

          {/* Start Date & End Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">备注</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="输入备注信息"
              rows={3}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 resize-y focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
            />
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
            disabled={isSaving || !name.trim()}
            className="rounded-lg bg-accent-cyan px-4 py-2 text-xs font-medium text-white transition-all hover:bg-accent-cyan/80 disabled:opacity-50"
          >
            {isSaving ? '保存中...' : isEditing ? '更新' : '创建'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
