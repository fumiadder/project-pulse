import { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DraggableWidgetProps {
  id: string;
  /** 宽度跨度：full=整行, half=半行, third=三分之一, quarter=四分之一, sixth=六分之一 */
  span?: 'full' | 'half' | 'third' | 'two-thirds' | 'quarter' | 'sixth';
  /** 编辑模式下显示拖拽手柄 */
  editMode: boolean;
  children: ReactNode;
}

/** span 对应的 grid-column class */
const SPAN_CLASS: Record<string, string> = {
  full:        'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-6',
  'two-thirds':'col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-3 2xl:col-span-4',
  half:        'col-span-1 md:col-span-1 lg:col-span-2 xl:col-span-2 2xl:col-span-3',
  third:       'col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-2 2xl:col-span-2',
  quarter:     'col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-1 2xl:col-span-2',
  sixth:       'col-span-1 md:col-span-1 lg:col-span-1 xl:col-span-1 2xl:col-span-1',
};

export function DraggableWidget({
  id,
  span = 'full',
  editMode,
  children,
}: DraggableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${SPAN_CLASS[span] ?? SPAN_CLASS.full} ${isDragging ? 'z-50 opacity-60' : ''}`}
      {...attributes}
    >
      <div
        className={`relative h-full transition-all ${
          isDragging ? 'shadow-2xl ring-2 ring-accent-cyan/40' : ''
        } ${editMode ? 'ring-1 ring-accent-cyan/20' : ''}`}
      >
        {/* 拖拽手柄 — 仅编辑模式显示 */}
        {editMode && (
          <div className="absolute -top-2 left-1/2 z-50 -translate-x-1/2">
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              className="flex h-6 cursor-grab items-center gap-1 rounded-full bg-accent-cyan/90 px-3 text-[10px] font-medium text-bg-primary shadow-lg active:cursor-grabbing hover:bg-accent-cyan"
              title="拖拽排序"
            >
              <i className="fas fa-grip-vertical text-[9px]" />
              <span>拖拽</span>
            </button>
          </div>
        )}

        {/* 实际内容 */}
        <div className="h-full">{children}</div>
      </div>
    </div>
  );
}
