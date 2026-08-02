import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Widget ID 类型 */
export type WidgetId =
  | 'focus'        // 今日聚焦
  | 'greeting'     // 问候卡 + 快速记录
  | 'vitals'       // 今日概览 + 数据汇总
  | 'checkin'      // 每日打卡
  | 'insights'     // 生产力洞察
  | 'heatmap'      // 活动热力图
  | 'todos';       // 待办列表

/** 默认排序 */
const DEFAULT_ORDER: WidgetId[] = [
  'focus',
  'greeting',
  'vitals',
  'checkin',
  'insights',
  'heatmap',
  'todos',
];

interface LayoutStore {
  /** Widget 排列顺序 */
  order: WidgetId[];
  /** 是否处于编辑模式（显示拖拽手柄） */
  editMode: boolean;
  /** 重排 Widget */
  reorder: (from: number, to: number) => void;
  /** 直接设置排序 */
  setOrder: (order: WidgetId[]) => void;
  /** 重置为默认排序 */
  resetOrder: () => void;
  /** 切换编辑模式 */
  toggleEditMode: () => void;
  /** 设置编辑模式 */
  setEditMode: (val: boolean) => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      order: DEFAULT_ORDER,
      editMode: false,

      reorder: (from, to) => {
        set((state) => {
          const newOrder = [...state.order];
          const [moved] = newOrder.splice(from, 1);
          newOrder.splice(to, 0, moved);
          return { order: newOrder };
        });
      },

      setOrder: (order) => set({ order }),

      resetOrder: () => set({ order: DEFAULT_ORDER }),

      toggleEditMode: () => set((state) => ({ editMode: !state.editMode })),
      setEditMode: (val) => set({ editMode: val }),
    }),
    {
      name: 'workbench-layout',
      partialize: (state) => ({ order: state.order }),
    },
  ),
);
