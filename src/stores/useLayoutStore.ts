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

/** 防抖保存计时器 + 待保存的数据 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: { userId: string | undefined; order: WidgetId[] } | null = null;

interface LayoutStore {
  /** Widget 排列顺序 */
  order: WidgetId[];
  /** 是否处于编辑模式（显示拖拽手柄） */
  editMode: boolean;
  /** 是否正在从服务器加载布局 */
  isLoading: boolean;
  /** 当前已加载布局的用户 ID（防止重复加载） */
  loadedUserId: string | undefined;
  /** 当前用户 ID（用于保存时确定 key，在 loadFromServer 调用时立即设置） */
  currentUserId: string | undefined;
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
  /** 立即保存待写入的数据（页面卸载时调用） */
  flushSave: () => void;
}

/** 校验并解析从服务器获取的排序数据 */
function parseOrder(raw: unknown): WidgetId[] | null {
  try {
    // 兼容字符串和 { value: string } 两种格式
    const str = typeof raw === 'string' ? raw : (raw as { value?: string })?.value;
    if (!str || typeof str !== 'string') return null;
    const parsed = JSON.parse(str);
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
function scheduleSave(userId: string | undefined, order: WidgetId[]) {
  // 记录待保存的数据
  pendingSave = { userId, order };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (!pendingSave) return;
    const { userId: uid, order: ord } = pendingSave;
    pendingSave = null;
    const key = getSettingKey(uid);
    try {
      await api.putSetting(key, JSON.stringify(ord));
    } catch (e) {
      console.error('[LayoutStore] 保存布局到服务器失败:', e);
    }
  }, 300);
}

/** 页面卸载时立即同步保存（使用 sendBeacon 确保请求发出） */
function flushSaveSync() {
  if (!pendingSave) return;
  const { userId, order } = pendingSave;
  pendingSave = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  // 使用 sendBeacon 确保页面卸载时请求仍能发出
  const key = getSettingKey(userId);
  const url = `${import.meta.env.VITE_API_BASE || '/api'}/settings/${encodeURIComponent(key)}`;
  const blob = new Blob([JSON.stringify({ value: JSON.stringify(order) })], { type: 'application/json' });
  try {
    navigator.sendBeacon(url, blob);
  } catch {
    // sendBeacon 不支持 PUT 方法，改用 fetch + keepalive
    try {
      fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(order) }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }
}

// 注册 beforeunload 监听器（仅注册一次）
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushSaveSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushSaveSync();
    }
  });
}

export const useLayoutStore = create<LayoutStore>()((set, get) => ({
  order: DEFAULT_ORDER,
  editMode: false,
  isLoading: false,
  loadedUserId: undefined,
  currentUserId: undefined,

  reorder: (from, to) => {
    const state = get();
    const newOrder = [...state.order];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    set({ order: newOrder });
    // 使用 currentUserId（在 loadFromServer 调用时已立即设置）
    scheduleSave(state.currentUserId, newOrder);
  },

  setOrder: (order) => {
    set({ order });
    scheduleSave(get().currentUserId, order);
  },

  resetOrder: () => {
    set({ order: DEFAULT_ORDER });
    scheduleSave(get().currentUserId, DEFAULT_ORDER);
  },

  toggleEditMode: () => set((state) => ({ editMode: !state.editMode })),
  setEditMode: (val) => set({ editMode: val }),

  flushSave: () => flushSaveSync(),

  loadFromServer: async (userId) => {
    const state = get();
    // 立即设置 currentUserId，确保后续 reorder 保存到正确的 key
    set({ currentUserId: userId });
    // 如果已经为该用户加载过且不在加载中，不重复加载
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
      scheduleSave(userId, DEFAULT_ORDER);
    } catch (e) {
      console.error('[LayoutStore] 从服务器加载布局失败:', e);
      set({ isLoading: false, loadedUserId: userId });
    }
  },
}));
