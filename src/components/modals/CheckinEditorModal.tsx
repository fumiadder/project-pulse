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
import { useCheckinStore } from '@/stores/useCheckinStore';
import { useUserStore } from '@/stores/useUserStore';
import type { CheckIn } from '@/types';

/** 预设 Emoji 图标 */
const EMOJI_OPTIONS = ['✓', '🏃', '📖', '💧', '🧘', '☕'] as const;

/** 预设颜色（name + hex） */
const COLOR_OPTIONS = [
  { name: 'green', hex: '#4a9a7a' },
  { name: 'blue', hex: '#5a7a9a' },
  { name: 'orange', hex: '#c4945a' },
  { name: 'purple', hex: '#7a5ac4' },
  { name: 'red', hex: '#c45a5a' },
  { name: 'cyan', hex: '#00d4ff' },
] as const;

interface CheckinEditorModalProps {
  open: boolean;
  onClose: () => void;
  checkinId?: string | null;
}

/** 生成唯一 ID */
function generateId(): string {
  return `checkin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function CheckinEditorModal({ open, onClose, checkinId }: CheckinEditorModalProps) {
  const { checkins, addCheckin, updateCheckin } = useCheckinStore();
  const { currentUser } = useUserStore();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>(EMOJI_OPTIONS[0]);
  const [color, setColor] = useState<string>(COLOR_OPTIONS[0].hex);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!checkinId;

  // 打开时初始化表单
  useEffect(() => {
    if (!open) return;

    if (checkinId) {
      const existing = checkins.find((c) => c.id === checkinId);
      if (existing) {
        setName(existing.name);
        setEmoji(existing.emoji || EMOJI_OPTIONS[0]);
        setColor(existing.color || COLOR_OPTIONS[0].hex);
      }
    } else {
      setName('');
      setEmoji(EMOJI_OPTIONS[0]);
      setColor(COLOR_OPTIONS[0].hex);
    }
  }, [open, checkinId, checkins]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);

    try {
      const now = new Date().toISOString();

      if (isEditing && checkinId) {
        const existing = checkins.find((c) => c.id === checkinId);
        if (existing) {
          const updated: CheckIn = {
            ...existing,
            name: name.trim(),
            emoji,
            color,
            updatedAt: now,
          };
          await updateCheckin(updated);
        }
      } else {
        const newCheckin: CheckIn = {
          id: generateId(),
          userId: currentUser?.id ?? '',
          name: name.trim(),
          emoji,
          color,
          streak: 0,
          lastDoneDate: null,
          history: [],
          createdAt: now,
          updatedAt: now,
        };
        await addCheckin(newCheckin);
      }

      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto bg-bg-secondary border-border-primary/30 text-text-primary">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            {isEditing ? '编辑打卡项' : '新建打卡项'}
          </DialogTitle>
          <DialogDescription className="text-text-muted">
            {isEditing ? '修改每日打卡项' : '创建新的每日打卡项'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 打卡项名称 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">打卡项名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入打卡项名称..."
              className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
              autoFocus
            />
          </div>

          {/* 图标选择 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">
              <i className="fas fa-icons text-accent-cyan mr-1" />
              图标
            </label>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`flex items-center justify-center rounded-lg border py-2 text-xl transition-colors ${
                    emoji === em
                      ? 'border-accent-cyan/50 bg-accent-cyan/10 text-text-primary'
                      : 'border-border-primary/30 text-text-secondary hover:border-border-hover hover:text-text-primary'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* 颜色选择 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">
              <i className="fas fa-palette text-accent-cyan mr-1" />
              颜色
            </label>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_OPTIONS.map((c) => {
                const isActive = color === c.hex;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    className={`flex items-center justify-center rounded-lg border py-2 transition-all ${
                      isActive
                        ? 'border-text-primary'
                        : 'border-border-primary/30 hover:border-border-hover'
                    }`}
                    title={c.name}
                  >
                    <span
                      className="block h-5 w-5 rounded-full transition-shadow"
                      style={{
                        backgroundColor: c.hex,
                        boxShadow: isActive
                          ? `0 0 0 2px ${c.hex}40, 0 0 0 4px ${c.hex}`
                          : 'none',
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="text-text-secondary">
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="bg-accent-cyan text-bg-primary hover:bg-accent-cyan/80"
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
