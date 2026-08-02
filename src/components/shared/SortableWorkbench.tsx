import { type ReactNode, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableWidget } from './DraggableWidget';
import { useLayoutStore, type WidgetId } from '@/stores/useLayoutStore';

/** Widget 渲染配置 */
export interface WidgetConfig {
  id: WidgetId;
  span: 'full' | 'half' | 'third' | 'two-thirds';
  render: () => ReactNode;
}

interface SortableWorkbenchProps {
  /** 所有 widget 的渲染配置 */
  widgets: WidgetConfig[];
}

export function SortableWorkbench({ widgets }: SortableWorkbenchProps) {
  const { order, reorder, editMode } = useLayoutStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /** 按 store 中的 order 排列 widgets */
  const sortedWidgets = useMemo(() => {
    const widgetMap = new Map(widgets.map((w) => [w.id, w]));
    // 过滤掉 store 中有但 widgets 中没有的 id（安全处理）
    const result = order
      .map((id) => widgetMap.get(id))
      .filter((w): w is WidgetConfig => !!w);
    // 补上 widgets 中有但 order 中没有的（新增的 widget）
    for (const w of widgets) {
      if (!order.includes(w.id)) {
        result.push(w);
      }
    }
    return result;
  }, [widgets, order]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedWidgets.findIndex((w) => w.id === active.id);
      const newIndex = sortedWidgets.findIndex((w) => w.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      reorder(oldIndex, newIndex);
    },
    [sortedWidgets, reorder],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedWidgets.map((w) => w.id)}
        strategy={rectSortingStrategy}
      >
        {/* 编辑模式提示条 */}
        {editMode && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 px-4 py-2">
            <div className="flex items-center gap-2">
              <i className="fas fa-arrows-up-down-left-right text-accent-cyan text-xs" />
              <span className="text-xs text-accent-cyan">
                编辑模式：拖拽卡片顶部的「拖拽」按钮即可调整顺序
              </span>
            </div>
            <button
              onClick={() => useLayoutStore.getState().resetOrder()}
              className="flex items-center gap-1 rounded-md bg-bg-tertiary px-2.5 py-1 text-[11px] text-text-muted hover:text-text-primary transition-colors"
            >
              <i className="fas fa-rotate-left text-[9px]" />
              重置布局
            </button>
          </div>
        )}

        {/* 响应式网格：1列(手机) → 2列(平板) → 3列(小桌面) → 4列(大桌面) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-auto">
          {sortedWidgets.map((widget) => (
            <DraggableWidget
              key={widget.id}
              id={widget.id}
              span={widget.span}
              editMode={editMode}
            >
              {widget.render()}
            </DraggableWidget>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
