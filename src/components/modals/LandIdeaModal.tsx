import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useUserStore } from '@/stores/useUserStore';
import type { Idea, Project } from '@/types';

interface LandIdeaModalProps {
  open: boolean;
  onClose: () => void;
  idea: Idea | null;
  onLand: (projectData: Partial<Project>) => void;
}

export function LandIdeaModal({ open, onClose, idea, onLand }: LandIdeaModalProps) {
  const { currentUser } = useUserStore();
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');

  useEffect(() => {
    if (open && idea) {
      setName(idea.title);
      // 每次打开都重置负责人为当前用户，确保正确
      setOwner(currentUser?.name || '');
    }
  }, [open, idea, currentUser]);

  const handleLand = () => {
    if (!name.trim()) return;
    onLand({ name: name.trim(), owner, desc: idea?.content || '' });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-bg-secondary border-border-primary/30 text-text-primary">
        <DialogHeader>
          <DialogTitle>落地想法</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <p className="text-xs text-text-muted">将想法「{idea?.title}」创建为一个新项目</p>
          <div>
            <label className="text-xs font-medium text-text-muted">项目名称 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted">负责人</label>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 mt-1" />
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border-custom px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-all">取消</button>
          <button onClick={handleLand} className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-white hover:bg-accent-cyan/80 transition-all">确认落地</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
