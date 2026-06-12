import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusTag } from '@/components/shared/StatusTag';
import { ProgressEditorModal } from '@/components/modals/ProgressEditorModal';
import type { Progress, Project, Attachment } from '@/types';
import {
  getWeekLabel,
  getWeekColor,
  getWeekBorderColor,
  getWeekStart,
  getWeekEnd,
} from '@/utils/weekUtils';

const ownerColorMap: Record<string, string> = {
  '唐宝': 'border-l-amber-500 bg-amber-500/10 text-amber-400',
  '周刚': 'border-l-purple-500 bg-purple-500/10 text-purple-400',
  '杨利莉': 'border-l-indigo-500 bg-indigo-500/10 text-indigo-400',
  '常超': 'border-l-blue-500 bg-blue-500/10 text-blue-400',
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MAX_ITEMS_PER_DAY = 12;

/** 状态选项：未开始、进行中、有风险、延期 */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'info', label: '未开始' },
  { value: 'normal', label: '进行中' },
  { value: 'warning', label: '有风险' },
  { value: 'danger', label: '延期' },
];

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function getProjectPath(projectId: string, projects: Project[]): string {
  const project = projects.find(p => p.id === projectId);
  if (!project) return '';
  if (!project.parentId) return project.name;
  const parent = projects.find(p => p.id === project.parentId);
  return parent ? `${parent.name} > ${project.name}` : project.name;
}

export function CalendarPage() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedEntry, setSelectedEntry] = useState<Progress | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editPercent, setEditPercent] = useState(0);
  const [editStatus, setEditStatus] = useState<string>('normal');
  const [editPlan, setEditPlan] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { projects } = useProjectStore();
  const { entries, updateEntry, deleteEntry, loadProgress } = useProgressStore();
  const todayStr = getTodayStr();

  // 页面加载时获取进度数据
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // 动作编辑弹窗状态（点击标签时打开 ProgressEditorModal）
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);


  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  // Build a map of date -> entries for current month view
  const entriesByDate = useMemo(() => {
    const map = new Map<string, Progress[]>();
    entries.forEach(e => {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    });
    return map;
  }, [entries]);

  // 计算当前月份中每个日期对应的周别
  const weekLabelByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDateStr(currentYear, currentMonth, d);
      map.set(dateStr, getWeekLabel(dateStr));
    }
    return map;
  }, [currentYear, currentMonth, daysInMonth]);

  // 按周别分组日期，用于渲染周别底色行
  const weekRows = useMemo(() => {
    const rows: { weekLabel: string; dates: string[] }[] = [];
    let currentWeek = '';
    let currentDates: string[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDateStr(currentYear, currentMonth, d);
      const wl = weekLabelByDate.get(dateStr) ?? '';
      if (wl !== currentWeek) {
        if (currentDates.length > 0) {
          rows.push({ weekLabel: currentWeek, dates: currentDates });
        }
        currentWeek = wl;
        currentDates = [dateStr];
      } else {
        currentDates.push(dateStr);
      }
    }
    if (currentDates.length > 0) {
      rows.push({ weekLabel: currentWeek, dates: currentDates });
    }
    return rows;
  }, [currentYear, currentMonth, daysInMonth, weekLabelByDate]);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const closeModal = useCallback(() => {
    setSelectedEntry(null);
    setIsEditing(false);
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedEntry) {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntry, closeModal]);

  const enterEditMode = () => {
    if (!selectedEntry) return;
    setEditContent(selectedEntry.content);
    setEditPercent(selectedEntry.percent);
    setEditStatus(selectedEntry.status);
    setEditPlan(selectedEntry.plan);
    setEditAttachments(selectedEntry.attachments || []);
    setIsEditing(true);
    setSaveSuccess(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setSaveSuccess(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
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
        setEditAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setEditAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSave = async () => {
    if (!selectedEntry) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updatedEntry: Progress = {
        ...selectedEntry,
        content: editContent,
        percent: editPercent,
        status: editStatus as Progress['status'],
        plan: editPlan,
        attachments: editAttachments,
        updatedAt: new Date().toISOString(),
      };
      await updateEntry(updatedEntry);
      setSelectedEntry(updatedEntry);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  // 点击标签时打开动作编辑弹窗（ProgressEditorModal）
  const handleTagClick = (entry: Progress) => {
    setEditingProgressId(entry.id);
    setProgressModalOpen(true);
  };

  const handleCloseProgressModal = () => {
    setProgressModalOpen(false);
    setEditingProgressId(null);
  };


  const monthLabel = `${currentYear}年${currentMonth + 1}月`;

  // Build calendar cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // 构建日期到周别的映射，用于快速查找
  const dateToWeekMap = useMemo(() => {
    const map = new Map<string, { weekLabel: string; bgColor: string; borderColor: string }>();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDateStr(currentYear, currentMonth, d);
      const wl = getWeekLabel(dateStr);
      map.set(dateStr, {
        weekLabel: wl,
        bgColor: getWeekColor(wl),
        borderColor: getWeekBorderColor(wl),
      });
    }
    return map;
  }, [currentYear, currentMonth, daysInMonth]);

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-display font-bold text-text-primary">
            <i className="fas fa-calendar-alt mr-2 text-accent-cyan" />
            {monthLabel}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 px-3 py-1.5 text-xs font-medium text-accent-cyan transition-all hover:bg-accent-cyan/10"
          >
            今天
          </button>
          <button
            onClick={goToPrevMonth}
            className="rounded-lg border border-border-primary/30 bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-tertiary"
          >
            <i className="fas fa-chevron-left" />
          </button>
          <button
            onClick={goToNextMonth}
            className="rounded-lg border border-border-primary/30 bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-tertiary"
          >
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px bg-border-primary/20 rounded-t-lg overflow-hidden">
        {WEEKDAYS.map((wd, i) => (
          <div
            key={i}
            className="bg-bg-secondary py-2 text-center text-xs font-medium text-text-muted"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* 周别图例 */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-[10px] text-text-muted">周别图例:</span>
        {weekRows.map(row => (
          <span
            key={row.weekLabel}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: getWeekColor(row.weekLabel),
              border: `1px solid ${getWeekBorderColor(row.weekLabel)}`,
              color: '#94a3b8',
            }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: getWeekBorderColor(row.weekLabel).replace('0.15', '0.6') }}
            />
            {row.weekLabel}
            <span className="text-text-muted/60">
              ({row.dates[0]?.slice(5)} ~ {row.dates[row.dates.length - 1]?.slice(5)})
            </span>
          </span>
        ))}
      </div>

      {/* Calendar grid - 固定高度，超出部分内联滚动 */}
      <div
        className="grid grid-cols-7 gap-px bg-border-primary/20 rounded-b-lg overflow-hidden"
        style={{ maxHeight: 'calc(100vh - 260px)', minHeight: '400px' }}
      >
        {cells.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="h-[180px] bg-bg-primary/50"
              />
            );
          }

          const dateStr = formatDateStr(currentYear, currentMonth, day);
          const dayEntries = entriesByDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;
          const weekInfo = dateToWeekMap.get(dateStr);
          const weekLabel = weekInfo?.weekLabel ?? '';

          return (
            <div
              key={day}
              className={`h-[180px] p-1.5 flex flex-col gap-0.5 relative ${
                isToday ? 'ring-2 ring-accent-cyan' : ''
              }`}
              style={{
                // 周别底色：使用非常淡的颜色（opacity 0.05），与负责人底色可叠加
                backgroundColor: weekInfo?.bgColor ?? undefined,
              }}
            >
              {/* Day number + 周别说明文字 */}
              <div className="flex items-center justify-between mb-0.5 shrink-0">
                <span
                  className={`text-xs font-medium ${
                    isToday
                      ? 'text-accent-cyan font-bold'
                      : 'text-text-muted'
                  }`}
                >
                  {day}
                </span>
                {/* 周别小标签 - 使用周别底色区分 */}
                {weekLabel && (
                  <span
                    className="text-[9px] font-medium px-1 py-px rounded"
                    style={{
                      border: `1px solid ${weekInfo?.borderColor}`,
                      color: '#94a3b8',
                      // 周别标签底色：使用稍深一点的颜色以便可见
                      backgroundColor: weekInfo?.borderColor ?? 'transparent',
                    }}
                  >
                    {weekLabel}
                  </span>
                )}
              </div>

              {/* Entries - 支持点击打开动作编辑弹窗 + 悬浮提示，可纵向滚动 */}
              <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
              {dayEntries.slice(0, MAX_ITEMS_PER_DAY).map(entry => {
                const project = projects.find(p => p.id === entry.projectId);
                const owner = project?.owner ?? '';
                const colorClasses = ownerColorMap[owner] ?? 'border-l-gray-500 bg-gray-500/10 text-gray-400';
                const projectPath = getProjectPath(entry.projectId, projects);

                return (
                  <div
                    key={entry.id}
                    onClick={() => handleTagClick(entry)}
                    className={`border-l-2 ${colorClasses} rounded-r px-1 py-px text-[10px] leading-tight cursor-pointer transition-colors hover:bg-white/5`}>
                    <div className="font-medium truncate">{owner}</div>
                    <div className="text-text-muted truncate">{entry.content.slice(0, 12)}</div>
                    <div className="text-text-muted/60 truncate text-[8px]">{projectPath}</div>
                    <span className="inline-block mt-px rounded bg-bg-primary/50 px-1 py-px text-[8px] font-medium">
                      {entry.percent}%
                    </span>
                  </div>
                );
              })}

              {/* Overflow indicator */}
              {dayEntries.length > MAX_ITEMS_PER_DAY && (
                <div className="text-[10px] text-text-muted text-center mt-0.5">
                  +{dayEntries.length - MAX_ITEMS_PER_DAY} 更多
                </div>
              )}
              </div>
            </div>
          );
        })}
      </div>


      {/* Selected Entry Detail Modal（保留原有详情弹窗） */}
      {selectedEntry && (() => {
        const project = projects.find(p => p.id === selectedEntry.projectId);
        const projectPath = getProjectPath(selectedEntry.projectId, projects);
        const owner = project?.owner ?? '';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60"
              onClick={closeModal}
            />
            {/* Modal Card */}
            <div className="relative w-full max-w-lg mx-4 rounded-xl bg-bg-secondary border border-border-primary/30 p-6 shadow-2xl animate-fade-in-up">
              {/* Close button */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-bg-primary/60 text-text-muted transition-colors hover:bg-bg-primary hover:text-text-primary"
              >
                <i className="fas fa-times text-xs" />
              </button>

              <div className="flex flex-col gap-4">
                {/* Project path */}
                <div>
                  <p className="text-xs text-text-muted mb-1">项目路径</p>
                  <p className="text-sm font-semibold text-text-primary">{projectPath}</p>
                </div>

                {/* Date */}
                <div>
                  <p className="text-xs text-text-muted mb-1">日期</p>
                  <p className="text-sm text-text-secondary">
                    <i className="far fa-calendar mr-1" />
                    {selectedEntry.date}
                  </p>
                </div>

                {/* Progress */}
                <div>
                  <p className="text-xs text-text-muted mb-1">进度</p>
                  {isEditing ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={editPercent}
                        onChange={e => setEditPercent(Number(e.target.value))}
                        className="flex-1 accent-accent-cyan"
                      />
                      <span className="text-sm font-bold text-text-primary min-w-[3rem] text-right">
                        {editPercent}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <ProgressBar percent={selectedEntry.percent} size="md" />
                      </div>
                      <span className="text-sm font-bold text-text-primary">
                        {selectedEntry.percent}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div>
                  <p className="text-xs text-text-muted mb-1">状态</p>
                  {isEditing ? (
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value)}
                      className="rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusTag status={selectedEntry.status} />
                  )}
                </div>

                {/* Content */}
                <div>
                  <p className="text-xs text-text-muted mb-1">内容</p>
                  {isEditing ? (
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                    />
                  ) : (
                    <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                      {selectedEntry.content || '暂无内容'}
                    </p>
                  )}
                </div>

                {/* Plan */}
                <div>
                  <p className="text-xs text-text-muted mb-1">计划</p>
                  {isEditing ? (
                    <textarea
                      value={editPlan}
                      onChange={e => setEditPlan(e.target.value)}
                      rows={3}
                      placeholder="输入计划..."
                      className="w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent-cyan/50"
                    />
                  ) : (
                    selectedEntry.plan ? (
                      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                        {selectedEntry.plan}
                      </p>
                    ) : (
                      <p className="text-sm text-text-muted">暂无计划</p>
                    )
                  )}
                </div>

                {/* Attachments */}
                <div>
                  <p className="text-xs text-text-muted mb-1">附件</p>
                  {isEditing ? (
                    <>
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
                      {editAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {editAttachments.map(att => (
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
                              <p className="text-[10px] text-text-muted mt-0.5 truncate max-w-[64px]">{att.name}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    (selectedEntry.attachments && selectedEntry.attachments.length > 0) ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedEntry.attachments.map(att => (
                          <div key={att.id} className="relative">
                            {att.isImage ? (
                              <img
                                src={att.data}
                                alt={att.name}
                                className="h-16 w-16 rounded-lg object-cover border border-border-primary/30 cursor-pointer transition-all hover:scale-105"
                                onClick={() => window.open(att.data, '_blank')}
                              />
                            ) : (
                              <a
                                href={att.data}
                                download={att.name}
                                className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-border-primary/30 bg-bg-secondary cursor-pointer transition-all hover:border-accent-cyan/30"
                              >
                                <i className="fas fa-file-download text-text-muted text-sm" />
                                <span className="text-[8px] text-text-muted mt-0.5 truncate max-w-[56px]">{att.name}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted">暂无附件</p>
                    )
                  )}
                </div>

                {/* Owner */}
                {owner && (
                  <div>
                    <p className="text-xs text-text-muted mb-1">负责人</p>
                    <p className="text-sm text-text-secondary">
                      <i className="far fa-user mr-1" />
                      {owner}
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-primary/20">
                  {isEditing ? (
                    <>
                      <button
                        onClick={cancelEdit}
                        disabled={isSaving}
                        className="rounded-lg border border-border-primary/30 bg-bg-primary px-4 py-2 text-xs font-medium text-text-secondary transition-all hover:bg-bg-tertiary disabled:opacity-50"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="rounded-lg bg-accent-cyan px-4 py-2 text-xs font-medium text-white transition-all hover:bg-accent-cyan/80 disabled:opacity-50"
                      >
                        {isSaving ? '保存中...' : saveSuccess ? '已保存' : '保存'}
                      </button>
                    </>
                  ) : (
                    <>
                      {saveSuccess && (
                        <span className="text-xs text-green-400 mr-auto">
                          <i className="fas fa-check-circle mr-1" />
                          保存成功
                        </span>
                      )}
                      <button
                        onClick={async () => {
                          if (!selectedEntry) return;
                          if (!window.confirm(`确定要删除这条进度记录吗？此操作不可撤销。`)) return;
                          await deleteEntry(selectedEntry.id);
                          closeModal();
                        }}
                        className="rounded-lg bg-accent-red px-4 py-2 text-xs font-medium text-white transition-all hover:bg-accent-red/80"
                      >
                        <i className="fas fa-trash mr-1.5" />
                        删除
                      </button>
                      <button
                        onClick={enterEditMode}
                        className="rounded-lg bg-accent-cyan px-4 py-2 text-xs font-medium text-white transition-all hover:bg-accent-cyan/80"
                      >
                        <i className="fas fa-pen mr-1.5" />
                        编辑
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 动作编辑弹窗 - 点击标签时打开 */}
      <ProgressEditorModal
        open={progressModalOpen}
        onClose={handleCloseProgressModal}
        progressId={editingProgressId}
      />
    </div>
  );
}
