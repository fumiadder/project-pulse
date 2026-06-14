import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Idea } from '@/types';

interface IdeaEditorModalProps {
  open: boolean;
  onClose: () => void;
  idea?: Idea | null;
  userId: string;
  onSave: (idea: Idea) => void;
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function IdeaEditorModal({ open, onClose, idea, userId, onSave }: IdeaEditorModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('中');
  const isEditing = !!idea;
  const prevIdeaIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const ideaId = idea?.id ?? null;
    // 只在 idea 对象变化时重置表单（通过 id 判断）
    if (ideaId !== prevIdeaIdRef.current) {
      prevIdeaIdRef.current = ideaId;
      if (idea) {
        setTitle(idea.title || '');
        setContent(idea.content || '');
        setPriority(idea.priority || '中');
      } else {
        setTitle('');
        setContent('');
        setPriority('中');
      }
    }
  }, [open, idea]);

  const handleSave = () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const newIdea: Idea = idea
      ? { ...idea, title: title.trim(), content: content.trim(), priority, updatedAt: now }
      : {
          id: generateId(),
          userId,
          title: title.trim(),
          content: content.trim(),
          tags: [],
          status: 'pending',
          landedProjectId: null,
          priority,
          createdAt: now,
          updatedAt: now,
        };
    onSave(newIdea);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-bg-secondary border-border-primary/30 text-text-primary">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑想法' : '新建想法'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div>
            <label className="text-xs font-medium text-text-muted">标题 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted">内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 mt-1 resize-y"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted">优先级</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 mt-1"
            >
              <option value="高">高</option>
              <option value="中">中</option>
              <option value="低">低</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border-custom px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-all">取消</button>
          <button onClick={handleSave} className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-white hover:bg-accent-cyan/80 transition-all">保存</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
