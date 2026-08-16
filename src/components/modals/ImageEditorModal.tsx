import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ImageEditorModalProps {
  src: string;
  onClose: () => void;
  onUpdateImage?: (oldSrc: string, newSrc: string) => void;
  onDeleteImage?: (src: string) => void;
  mode?: 'view' | 'edit';
}

export function ImageEditorModal({ src, onClose }: ImageEditorModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // 重置缩放和位置
  const resetView = useCallback(() => {
    setZoom(1);
    setPos({ x: 0, y: 0 });
  }, []);

  // 缩放
  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 5));
  }, []);
  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const newZoom = Math.max(z - 0.25, 0.5);
      if (newZoom <= 1) setPos({ x: 0, y: 0 });
      return newZoom;
    });
  }, []);

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => {
      const newZoom = Math.min(Math.max(z + delta, 0.5), 5);
      if (newZoom <= 1) setPos({ x: 0, y: 0 });
      return newZoom;
    });
  }, []);

  // 拖拽平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  }, [zoom, pos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 双击重置
  const handleDoubleClick = useCallback(() => {
    if (zoom !== 1) {
      resetView();
    } else {
      setZoom(2);
    }
  }, [zoom, resetView]);

  // Escape 键关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const zoomPercent = Math.round(zoom * 100);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
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

      {/* 左上角缩放百分比 */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs text-white/70 backdrop-blur-sm">
        <i className="fas fa-search-plus text-[10px]" />
        {zoomPercent}%
      </div>

      {/* 图片容器 */}
      <div
        ref={containerRef}
        className="relative flex max-h-[80vh] max-w-[90vw] items-center justify-center overflow-hidden"
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={src}
          alt="查看图片"
          className="max-h-[80vh] max-w-full select-none rounded-lg transition-transform duration-100"
          style={{
            transform: `scale(${zoom}) translate(${pos.x / zoom}px, ${pos.y / zoom}px)`,
            transformOrigin: 'center center',
          }}
          draggable={false}
        />
      </div>

      {/* 底部缩放控制 */}
      <div className="mt-4 flex items-center gap-2 rounded-full bg-white/10 px-2 py-1.5 backdrop-blur-sm">
        <button
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          disabled={zoom <= 0.5}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-all hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="缩小"
        >
          <i className="fas fa-minus text-xs" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); resetView(); }}
          className="min-w-[3rem] rounded-full px-3 py-1 text-xs text-white/80 transition-all hover:bg-white/10"
          title="重置"
        >
          {zoomPercent}%
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          disabled={zoom >= 5}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-all hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="放大"
        >
          <i className="fas fa-plus text-xs" />
        </button>
      </div>

      {/* 底部提示 */}
      <p className="mt-2 text-[10px] text-white/30">
        滚轮缩放 · 拖拽平移 · 双击切换 · ESC 关闭
      </p>
    </div>,
    document.body
  );
}
