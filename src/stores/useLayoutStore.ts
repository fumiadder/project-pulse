import { create } from 'zustand';
import { api } from '@/services/api';

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

/** 合法的 WidgetId 集合，用于校验从服务器加载的数据 */
const VALID_IDS = new Set<string>(DEFAULT_ORDER);

/** 服务器端存储 key 前缀 */
const SETTING_KEY_PREFIX = 'workbench_layout';

/** 获取用户对应的设置 key */
function getSettingKey(userId?: string): string {
  return userId ? `${SETTING_KEY_PREFIX}:${userId}` : SETTING_KEY_PREFIX;
}

/** 防抖保存计时器 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;

interface LayoutStore {
  /** Widget 排列顺序 */
  order: WidgetId[];
  /** 是否处于编辑模式（显示拖拽手柄） */
  editMode: boolean;
  /** 是否正在从服务器加载布局 */
  isLoading: boolean;
  /** 当前已加载布局的用户 ID（防止重复加载） */
  loadedUserId: string | undefined;
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
  /** 从服务器加载布局（登录后调用） */
  loadFromServer: (userId?: string) => Promise<void>;
}

/** 校验并解析从服务器获取的排序数据 */
function parseOrder(raw: string): WidgetId[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // 校验每一项都是合法的 WidgetId
    const valid = parsed.filter((id: unknown) => typeof id === 'string' && VALID_IDS.has(id));
    if (valid.length === 0) return null;
    // 补全缺失的 widget（新增的 widget 默认追加到末尾）
    for (const id of DEFAULT_ORDER) {
      if (!valid.includes(id)) {
        valid.push(id);
      }
    }
    return valid as WidgetId[];
  } catch {
    return null;
  }
}

/** 防抖保存布局到服务器 */
function saveToServer(userId: string | undefined, order: WidgetId[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const key = getSettingKey(userId);
    try {
      await api.putSetting(key, JSON.stringify(order));
    } catch (e) {
      console.error('[LayoutStore] 保存布局到服务器失败:', e);
    }
  }, 500);
}

export const useLayoutStore = create<LayoutStore>()((set, get) => ({
  order: DEFAULT_ORDER,
  editMode: false,
  isLoading: false,
  loadedUserId: undefined,

  reorder: (from, to) => {
    const state = get();
    const newOrder = [...state.order];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    set({ order: newOrder });
    saveToServer(state.loadedUserId, newOrder);
  },

  setOrder: (order) => {
    set({ order });
    saveToServer(get().loadedUserId, order);
  },

  resetOrder: () => {
    set({ order: DEFAULT_ORDER });
    saveToServer(get().loadedUserId, DEFAULT_ORDER);
  },

  toggleEditMode: () => set((state) => ({ editMode: !state.editMode })),
  setEditMode: (val) => set({ editMode: val }),

  loadFromServer: async (userId) => {
    const state = get();
    // 如果已经为该用户加载过，不重复加载
    if (state.loadedUserId === userId && !state.isLoading) return;

    set({ isLoading: true });
    try {
      const key = getSettingKey(userId);
      const res = await api.getSetting(key);
      if (res.success && res.data) {
        const parsed = parseOrder(res.data);
        if (parsed) {
          set({ order: parsed, loadedUserId: userId, isLoading: false });
          return;
        }
      }
      // 服务器上没有数据或解析失败，使用默认排序，并保存到服务器
      set({ order: DEFAULT_ORDER, loadedUserId: userId, isLoading: false });
      saveToServer(userId, DEFAULT_ORDER);
    } catch (e) {
      console.error('[LayoutStore] 从服务器加载布局失败:', e);
      set({ isLoading: false, loadedUserId: userId });
    }
  },
}));
