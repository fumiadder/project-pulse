import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ImageEditorModalProps {
  src: string;
  onClose: () => void;
  onUpdateImage: (oldSrc: string, newSrc: string) => void;
  onDeleteImage: (src: string) => void;
  mode?: 'view' | 'edit';
}

interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function ImageEditorModal({ src, onClose, onUpdateImage, onDeleteImage, mode: initialMode = 'view' }: ImageEditorModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);

  // 鼠标按下：开始框选
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawing(true);
    setStartPoint({ x, y });
    setSelection({ x, y, w: 0, h: 0 });
  }, []);

  // 鼠标移动：更新框选区域
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelection({
        x: Math.min(startPoint.x, x),
        y: Math.min(startPoint.y, y),
        w: Math.abs(x - startPoint.x),
        h: Math.abs(y - startPoint.y),
      });
    },
    [isDrawing, startPoint],
  );

  // 鼠标抬起：结束框选
  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    if (selection && (selection.w < 5 || selection.h < 5)) {
      setSelection(null);
    }
  }, [selection]);

  /** 获取选区在原始图片中的坐标 */
  const getSelectionInNaturalCoords = useCallback(() => {
    if (!selection || selection.w < 5 || selection.h < 5) return null;
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return null;

    const displayedWidth = img.clientWidth;
    const displayedHeight = img.clientHeight;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const imgOffsetX = imgRect.left - containerRect.left;
    const imgOffsetY = imgRect.top - containerRect.top;

    const scaleX = naturalWidth / displayedWidth;
    const scaleY = naturalHeight / displayedHeight;

    return {
      sx: Math.max(0, (selection.x - imgOffsetX) * scaleX),
      sy: Math.max(0, (selection.y - imgOffsetY) * scaleY),
      sw: selection.w * scaleX,
      sh: selection.h * scaleY,
      naturalWidth,
      naturalHeight,
    };
  }, [selection]);

  /** 加载图片为 HTMLImageElement */
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  /** 删除选区：将选中区域填充为白色 */
  const handleDeleteSelection = useCallback(async () => {
    const coords = getSelectionInNaturalCoords();
    if (!coords) return;

    setIsProcessing(true);
    try {
      const tempImg = await loadImage(currentSrc);
      const canvas = document.createElement('canvas');
      canvas.width = coords.naturalWidth;
      canvas.height = coords.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(tempImg, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(coords.sx, coords.sy, coords.sw, coords.sh);

      const newDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const oldSrc = currentSrc;
      setCurrentSrc(newDataUrl);
      onUpdateImage(oldSrc, newDataUrl);
      setSelection(null);
    } catch {
      // 忽略错误
    } finally {
      setIsProcessing(false);
    }
  }, [currentSrc, getSelectionInNaturalCoords, onUpdateImage]);

  /** 裁剪选区：只保留选中区域 */
  const handleCropSelection = useCallback(async () => {
    const coords = getSelectionInNaturalCoords();
    if (!coords) return;

    setIsProcessing(true);
    try {
      const tempImg = await loadImage(currentSrc);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(coords.sw);
      canvas.height = Math.round(coords.sh);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(
        tempImg,
        coords.sx,
        coords.sy,
        coords.sw,
        coords.sh,
        0,
        0,
        coords.sw,
        coords.sh,
      );

      const newDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const oldSrc = currentSrc;
      setCurrentSrc(newDataUrl);
      onUpdateImage(oldSrc, newDataUrl);
      setSelection(null);
    } catch {
      // 忽略错误
    } finally {
      setIsProcessing(false);
    }
  }, [currentSrc, getSelectionInNaturalCoords, onUpdateImage]);

  /** 删除整张图片 */
  const handleDeleteImage = useCallback(() => {
    onDeleteImage(currentSrc);
    onClose();
  }, [currentSrc, onDeleteImage, onClose]);

  // Escape 键处理
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selection) {
          setSelection(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection, onClose]);

  const hasValidSelection = selection && selection.w >= 5 && selection.h >= 5;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        // 点击背景区域关闭，但不让事件冒泡到 Radix Dialog
        if (e.target === e.currentTarget) onClose();
        e.stopPropagation();
      }}
    >
      {/* 右上角关闭按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white transition-all hover:bg-white/30 active:scale-95 shadow-lg"
        aria-label="关闭"
      >
        <i className="fas fa-times text-lg" />
      </button>

      {/* 工具栏（仅编辑模式显示） */}
      {mode === 'edit' && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2 px-4">
          <button
            onClick={handleDeleteSelection}
            disabled={!hasValidSelection || isProcessing}
            className="flex items-center gap-1.5 rounded-lg bg-accent-red/20 px-3 py-1.5 text-xs text-accent-red transition-colors hover:bg-accent-red/30 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <i className="fas fa-eraser" />
            删除选区
          </button>
          <button
            onClick={handleCropSelection}
            disabled={!hasValidSelection || isProcessing}
            className="flex items-center gap-1.5 rounded-lg bg-accent-cyan/20 px-3 py-1.5 text-xs text-accent-cyan transition-colors hover:bg-accent-cyan/30 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <i className="fas fa-crop" />
            裁剪选区
          </button>
          <button
            onClick={handleDeleteImage}
            disabled={isProcessing}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20 disabled:opacity-30"
          >
            <i className="fas fa-trash" />
            删除图片
          </button>
        </div>
      )}

      {/* 提示文字（仅编辑模式显示） */}
      {mode === 'edit' && (
        <p className="mb-2 text-[10px] text-white/40">
          <i className="fas fa-vector-square mr-1" />
          在图片上拖拽框选区域进行编辑
        </p>
      )}

      {/* 图片容器（含框选叠层） */}
      <div
        ref={containerRef}
        className="relative max-h-[75vh] max-w-[90vw] select-none"
        onMouseDown={mode === 'edit' ? handleMouseDown : undefined}
        onMouseMove={mode === 'edit' ? handleMouseMove : undefined}
        onMouseUp={mode === 'edit' ? handleMouseUp : undefined}
        onMouseLeave={mode === 'edit' ? handleMouseUp : undefined}
        style={{ cursor: mode === 'edit' ? 'crosshair' : 'default' }}
      >
        <img
          ref={imgRef}
          src={currentSrc}
          alt={mode === 'edit' ? '编辑图片' : '查看图片'}
          className="max-h-[75vh] max-w-full rounded-lg pointer-events-none"
          draggable={false}
        />
        {/* 框选叠层 */}
        {mode === 'edit' && selection && (
          <div
            className="pointer-events-none absolute border-2 border-accent-cyan bg-accent-cyan/20"
            style={{
              left: `${selection.x}px`,
              top: `${selection.y}px`,
              width: `${selection.w}px`,
              height: `${selection.h}px`,
            }}
          />
        )}
      </div>

      {/* 查看模式：底部操作按钮 */}
      {mode === 'view' && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); setMode('edit'); }}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm text-white transition-all hover:bg-white/20 active:scale-95"
          >
            <i className="fas fa-pen text-xs" />
            编辑图片
          </button>
        </div>
      )}

      {/* 处理中提示 */}
      {isProcessing && (
        <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
          <i className="fas fa-spinner fa-spin" />
          处理中...
        </div>
      )}

      {/* 选区信息 */}
      {mode === 'edit' && hasValidSelection && !isProcessing && (
        <div className="mt-2 text-[10px] text-white/40">
          选区：{Math.round(selection!.w)} × {Math.round(selection!.h)} px
        </div>
      )}
    </div>,
    document.body
  );
}
