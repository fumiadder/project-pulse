import { useRef, useEffect, useCallback } from 'react';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onPasteFiles?: (files: FileList) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  className?: string;
}

export function AutoResizeTextarea({
  value,
  onChange,
  onPasteFiles,
  placeholder,
  minRows = 4,
  maxRows = 20,
  className = '',
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // 先重置高度以获取正确的 scrollHeight
    el.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 20;
    const minHeight = minRows * lineHeight + 16; // 16 = padding
    const maxHeight = maxRows * lineHeight + 16;
    const newHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${newHeight}px`;
  }, [minRows, maxRows]);

  // 值变化时调整高度
  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // 处理粘贴事件
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData.items;
      const files: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0 && onPasteFiles) {
        e.preventDefault();
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        onPasteFiles(dt.files);
      }
    },
    [onPasteFiles]
  );

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onPaste={handlePaste}
      placeholder={placeholder}
      rows={minRows}
      className={`w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 resize-none focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 overflow-y-auto ${className}`}
      style={{ transition: 'height 0.15s ease' }}
    />
  );
}
