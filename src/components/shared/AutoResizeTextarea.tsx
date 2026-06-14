import { useRef, useEffect, useCallback, useState } from 'react';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onPasteFiles?: (files: FileList) => void;
  onImageClick?: (src: string, name: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  className?: string;
}

export function AutoResizeTextarea({
  value,
  onChange,
  onPasteFiles,
  onImageClick,
  placeholder,
  minRows = 4,
  maxRows = 20,
  className = '',
}: AutoResizeTextareaProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const isInternalUpdate = useRef(false);

  // 同步外部 value 到编辑器
  useEffect(() => {
    const el = editorRef.current;
    if (!el || isInternalUpdate.current) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(el).lineHeight, 10) || 20;
    const minHeight = minRows * lineHeight + 16;
    const maxHeight = maxRows * lineHeight + 500;
    const newHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${newHeight}px`;
  }, [minRows, maxRows]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // 处理输入
  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el || isComposing) return;
    isInternalUpdate.current = true;
    onChange(el.innerHTML);
    adjustHeight();
    requestAnimationFrame(() => {
      isInternalUpdate.current = false;
    });
  }, [onChange, adjustHeight, isComposing]);

  // 在光标位置插入图片元素
  const insertImageAtCursor = useCallback((src: string, name: string) => {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'inline-preview-img';
    img.style.maxWidth = '200px';
    img.style.maxHeight = '150px';
    img.style.borderRadius = '6px';
    img.style.margin = '4px 2px';
    img.style.cursor = 'pointer';
    img.title = name;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editorRef.current?.appendChild(img);
    }
  }, []);

  // 点击图片预览
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && onImageClick) {
      const img = target as HTMLImageElement;
      onImageClick(img.src, img.title || img.alt || '图片');
    }
  }, [onImageClick]);

  // 处理粘贴事件
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData.items;
      const files: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();

        // 如果有文本，先插入
        const text = e.clipboardData.getData('text/plain');
        if (text) {
          document.execCommand('insertText', false, text);
        }

        // 图片在光标位置插入预览
        files.forEach((file) => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              insertImageAtCursor(dataUrl, file.name);
              handleInput();
              adjustHeight();
            };
            reader.readAsDataURL(file);
          }
        });

        // 通知外部上传文件
        if (onPasteFiles) {
          const dt = new DataTransfer();
          files.forEach((f) => dt.items.add(f));
          onPasteFiles(dt.files);
        }
      }
    },
    [onPasteFiles, handleInput, adjustHeight, insertImageAtCursor]
  );

  // IME 输入法
  const handleCompositionStart = useCallback(() => setIsComposing(true), []);
  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
    handleInput();
  }, [handleInput]);

  // 拖拽文件
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && onPasteFiles) {
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        onPasteFiles(dt.files);

        files.forEach((file) => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              insertImageAtCursor(dataUrl, file.name);
              handleInput();
              adjustHeight();
            };
            reader.readAsDataURL(file);
          }
        });
      }
    },
    [onPasteFiles, handleInput, adjustHeight, insertImageAtCursor]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onPaste={handlePaste}
      onClick={handleClick}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      data-placeholder={placeholder}
      className={`w-full rounded-lg border border-border-primary/30 bg-bg-primary px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-text-muted/50 ${className}`}
      style={{
        minHeight: `${minRows * 20 + 16}px`,
        transition: 'height 0.15s ease',
      }}
    />
  );
}
