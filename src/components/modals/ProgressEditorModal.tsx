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
import { uploadFile, getFileUrl } from '@/services/api';
import { AutoResizeTextarea } from '@/components/shared/AutoResizeTextarea';
import type { Progress, Attachment } from '@/types';

/** 状态选项：与进度百分比强绑定 */
const STATUS_OPTIONS = [
  { value: 'info', label: '未开始' },
  { value: 'normal', label: '进行中' },
  { value: 'warning', label: '有风险' },
  { value: 'danger', label: '延期' },
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

/** 根据进度百分比自动获取状态 */
function getAutoStatus(percent: number): string {
  if (percent >= 100) return 'normal'; // 已完成
  return 'normal'; // 进行中
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 获取文件图标 */
function getFileIcon(type: string): string {
  if (type.startsWith('image/')) return 'fa-image';
  if (type.includes('pdf')) return 'fa-file-pdf';
  if (type.includes('word') || type.includes('doc')) return 'fa-file-word';
  if (type.includes('excel') || type.includes('sheet') || type.includes('xls')) return 'fa-file-excel';
  if (type.startsWith('video/')) return 'fa-file-video';
  if (type.startsWith('audio/')) return 'fa-file-audio';
  return 'fa-file';
}

interface ProgressEditorModalProps {
  open: boolean;
  onClose: () => void;
  progressId?: string | null;
  preDate?: string;
  preProjectId?: string;
}

/** 图片预览弹窗组件 */
function ImagePreviewModal({
  src,
  name,
  onClose,
}: {
  src: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <img
          src={src}
          alt={name}
          className="max-w-full max-h-[85vh] rounded-lg object-contain"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2 rounded-b-lg">
          <p className="text-xs text-white text-center truncate">{name}</p>
        </div>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors"
        >
          <i className="fas fa-times" />
        </button>
      </div>
    </div>
  );
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 图片预览状态
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);

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

  // 进度变化时自动更新状态
  useEffect(() => {
    if (open) {
      setStatus(getAutoStatus(percent));
    }
  }, [percent, open]);

  /** 处理文件上传 - 优先使用 API 上传，失败时回退到 dataURL */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    setUploadProgress(`正在上传 ${files.length} 个文件...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`正在上传 ${file.name} (${i + 1}/${files.length})...`);

      try {
        // 尝试通过 API 上传
        const result = await uploadFile(file);
        if (result.success && result.data) {
          const uploadedFile = result.data;
          const isImage = file.type.startsWith('image/');
          const newAttachment: Attachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: uploadedFile.name,
            type: uploadedFile.type,
            size: uploadedFile.size,
            data: uploadedFile.url, // 使用服务器返回的 URL
            isImage,
            url: uploadedFile.url, // 保存服务器 URL
          };
          setAttachments((prev) => [...prev, newAttachment]);
        } else {
          // API 上传失败，回退到 dataURL
          await readFileAsDataURL(file);
        }
      } catch {
        // API 上传失败，回退到 dataURL
        await readFileAsDataURL(file);
      }
    }

    setIsUploading(false);
    setUploadProgress('');
    if (e.target) e.target.value = '';
  };

  /** 将文件读取为 dataURL（备用方案） */
  const readFileAsDataURL = (file: File): Promise<void> => {
    return new Promise((resolve) => {
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
        resolve();
      };
      reader.readAsDataURL(file);
    });
  };

  /** 处理粘贴上传的文件 */
  const handlePasteFiles = async (files: FileList) => {
    setIsUploading(true);
    setUploadProgress(`正在上传 ${files.length} 个文件...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`正在上传 ${file.name} (${i + 1}/${files.length})...`);

      try {
        const result = await uploadFile(file);
        if (result.success && result.data) {
          const uploadedFile = result.data;
          const isImage = file.type.startsWith('image/');
          const newAttachment: Attachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: uploadedFile.name,
            type: uploadedFile.type,
            size: uploadedFile.size,
            data: uploadedFile.url,
            isImage,
            url: uploadedFile.url,
          };
          setAttachments((prev) => [...prev, newAttachment]);
        } else {
          await readFileAsDataURL(file);
        }
      } catch {
        await readFileAsDataURL(file);
      }
    }

    setIsUploading(false);
    setUploadProgress('');
  };

  /** 移除附件 */
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  /** 点击图片预览 */
  const handlePreviewImage = (att: Attachment) => {
    if (att.isImage) {
      // 如果有服务器 URL，使用 getFileUrl 获取完整路径
      const src = att.url ? getFileUrl(att.url) : att.data;
      setPreviewImage({ src, name: att.name });
    }
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
    <>
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
              {/* 状态与进度强绑定提示 */}
              <p className="text-[10px] text-text-muted">
                <i className="fas fa-info-circle mr-0.5" />
                状态将根据进度自动设置：{percent >= 100 ? '已完成' : '进行中'}
              </p>
            </div>

            {/* Status (自动根据进度设置，但仍可手动调整) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">状态（自动根据进度设置）</label>
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
              <AutoResizeTextarea
                value={content}
                onChange={(v) => setContent(v)}
                onPasteFiles={handlePasteFiles}
                placeholder="输入进度内容，支持粘贴图片/文件"
                minRows={4}
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
              <label className="text-xs font-medium text-text-muted">
                附件（支持图片、PDF、Word、Excel 等文件）
              </label>

              {/* 上传区域 */}
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-primary/30 bg-bg-primary/50 px-4 py-3 cursor-pointer transition-all ${
                  isUploading
                    ? 'opacity-50 cursor-not-allowed border-accent-cyan/30'
                    : 'hover:border-accent-cyan/40 hover:bg-accent-cyan/5'
                }`}
              >
                {isUploading ? (
                  <>
                    <i className="fas fa-spinner fa-spin text-accent-cyan" />
                    <span className="text-xs text-accent-cyan">{uploadProgress}</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-cloud-upload-alt text-accent-cyan" />
                    <span className="text-xs text-text-muted">点击或拖拽上传文件</span>
                    <span className="text-[10px] text-text-muted/50">（支持多选）</span>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.mp4,.mov,.avi"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* 已上传文件列表 */}
              {attachments.length > 0 && (
                <div className="space-y-2 mt-2">
                  <div className="text-[10px] text-text-muted">
                    已上传 {attachments.length} 个文件
                  </div>
                  <div className="space-y-1.5">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 rounded-lg border border-border-primary/20 bg-bg-primary/50 px-3 py-2 group hover:bg-bg-tertiary/30 transition-colors"
                      >
                        {/* 文件图标或缩略图 */}
                        {att.isImage ? (
                          <img
                            src={att.data}
                            alt={att.name}
                            className="h-10 w-10 rounded-lg object-cover border border-border-primary/20 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                            onClick={() => handlePreviewImage(att)}
                            title="点击预览"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-primary/20 bg-bg-secondary shrink-0">
                            <i className={`fas ${getFileIcon(att.type)} text-text-muted text-sm`} />
                          </div>
                        )}

                        {/* 文件信息 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-primary truncate">{att.name}</p>
                          <p className="text-[10px] text-text-muted">
                            {formatFileSize(att.size)}
                            {att.isImage && ' (点击图片可预览)'}
                          </p>
                        </div>

                        {/* 删除按钮 */}
                        <button
                          onClick={() => removeAttachment(att.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-text-muted hover:bg-accent-red/10 hover:text-accent-red transition-colors opacity-0 group-hover:opacity-100"
                          title="删除"
                        >
                          <i className="fas fa-times text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
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
              disabled={isSaving || isUploading || !content.trim() || !projectId}
              className="rounded-lg bg-accent-cyan px-4 py-2 text-xs font-medium text-white transition-all hover:bg-accent-cyan/80 disabled:opacity-50"
            >
              {isSaving ? '保存中...' : isEditing ? '更新' : '创建'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 图片预览弹窗 */}
      {previewImage && (
        <ImagePreviewModal
          src={previewImage.src}
          name={previewImage.name}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </>
  );
}
