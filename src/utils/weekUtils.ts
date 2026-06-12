// ============================================
// 周别计算工具函数
// 规则：周四到周三为一周，每周四开始新的一周
// ============================================

/**
 * 给定日期字符串（YYYY-MM-DD），计算属于哪一周
 * 返回格式：wkXX（从年初第一周开始计数）
 *
 * 周的定义：周四到周三为一周
 * 例如：2026-01-01（周四）属于 wk01
 *       2026-01-07（周三）也属于 wk01
 *       2026-01-08（周四）属于 wk02
 */
export function getWeekLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const year = date.getFullYear();

  // 找到该年的第一个周四
  const jan1 = new Date(year, 0, 1);
  let firstThursday = new Date(jan1);

  // 计算1月1日是周几（0=周日，4=周四）
  const jan1Day = jan1.getDay();
  // 如果1月1日不是周四，找到第一个周四
  const diffToThursday = (4 - jan1Day + 7) % 7;
  firstThursday = new Date(year, 0, 1 + diffToThursday);

  // 如果第一个周四落在上一年，则使用下一个周四
  if (firstThursday.getFullYear() !== year) {
    firstThursday = new Date(year, 0, 1 + diffToThursday + 7);
  }

  // 计算给定日期与第一个周四之间的天数差
  const dateMs = date.getTime();
  const firstThursdayMs = firstThursday.getTime();
  const diffDays = Math.floor((dateMs - firstThursdayMs) / (24 * 60 * 60 * 1000));

  // 如果日期在第一个周四之前，它属于上一年的最后一周
  if (diffDays < 0) {
    // 递归到上一年计算
    const prevYearLastThursday = new Date(year - 1, 11, 31);
    const prevYearDay = prevYearLastThursday.getDay();
    const prevDiffToThursday = (4 - prevYearDay + 7) % 7;
    const prevFirstThursday = new Date(year - 1, 0, 1 + prevDiffToThursday);
    if (prevFirstThursday.getFullYear() !== year - 1) {
      prevFirstThursday.setDate(prevFirstThursday.getDate() + 7);
    }
    const prevDiffDays = Math.floor(
      (dateMs - prevFirstThursday.getTime()) / (24 * 60 * 60 * 1000)
    );
    const weekNum = Math.floor(prevDiffDays / 7) + 1;
    return `wk${String(weekNum).padStart(2, '0')}`;
  }

  // 计算周数：从第一个周四开始，每7天一周
  const weekNum = Math.floor(diffDays / 7) + 1;
  return `wk${String(weekNum).padStart(2, '0')}`;
}

/**
 * 获取给定日期字符串所在周的起始日期（周四）
 */
export function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay(); // 0=周日, 1=周一, ..., 4=周四
  // 计算到本周四的偏移量
  // 如果今天是周四(4)，偏移为0；周三(3)偏移-6；周五(5)偏移-1
  const offset = (day - 4 + 7) % 7;
  const thursday = new Date(date);
  thursday.setDate(thursday.getDate() - offset);
  return formatDate(thursday);
}

/**
 * 获取给定日期字符串所在周的结束日期（周三）
 */
export function getWeekEnd(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  // 计算到本周三的偏移量
  const offset = (day - 3 + 7) % 7;
  const wednesday = new Date(date);
  wednesday.setDate(wednesday.getDate() + (7 - offset) % 7);
  return formatDate(wednesday);
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 获取今天的日期字符串 YYYY-MM-DD
 */
export function getTodayStr(): string {
  return formatDate(new Date());
}

/**
 * 根据周别标签生成不同的底色
 * 使用哈希算法为不同周生成稳定的颜色
 */
// 全局 Map：记录每个周别首次出现时的索引，确保不同周别使用不同颜色
let _weekColorIndex = 0;
const _weekColorMap = new Map<string, number>();

function getWeekColorIndex(weekLabel: string): number {
  if (!_weekColorMap.has(weekLabel)) {
    _weekColorMap.set(weekLabel, _weekColorIndex++);
  }
  return _weekColorMap.get(weekLabel)!;
}

const WEEK_COLORS = [
  'rgba(0, 212, 255, 0.06)',    // 0  青
  'rgba(0, 255, 136, 0.06)',    // 1  绿
  'rgba(255, 140, 0, 0.06)',    // 2  橙
  'rgba(168, 85, 247, 0.06)',   // 3  紫
  'rgba(255, 51, 102, 0.06)',   // 4  红
  'rgba(255, 217, 61, 0.06)',   // 5  黄
  'rgba(59, 130, 246, 0.06)',   // 6  蓝
  'rgba(236, 72, 153, 0.06)',   // 7  粉
  'rgba(20, 184, 166, 0.06)',   // 8  青绿
  'rgba(132, 204, 22, 0.06)',   // 9  黄绿
  'rgba(251, 146, 60, 0.06)',   // 10 深橙
  'rgba(139, 92, 246, 0.06)',   // 11 深紫
  'rgba(244, 63, 94, 0.06)',    // 12 玫红
  'rgba(56, 189, 248, 0.06)',   // 13 天蓝
  'rgba(163, 230, 53, 0.06)',   // 14 草绿
  'rgba(217, 119, 6, 0.06)',    // 15 琥珀
  'rgba(99, 102, 241, 0.06)',   // 16 靛蓝
  'rgba(239, 68, 68, 0.06)',    // 17 亮红
  'rgba(34, 211, 238, 0.06)',    // 18 湖蓝
  'rgba(74, 222, 128, 0.06)',   // 19 薄荷
  'rgba(245, 158, 11, 0.06)',   // 20 金色
  'rgba(167, 139, 250, 0.06)',  // 21 薰紫
  'rgba(248, 113, 113, 0.06)',  // 22 珊瑚
  'rgba(45, 212, 191, 0.06)',   // 23 碧绿
  'rgba(190, 242, 100, 0.06)',  // 24 嫩绿
  'rgba(196, 181, 253, 0.06)',  // 25 薰衣草
];

const WEEK_BORDER_COLORS = [
  'rgba(0, 212, 255, 0.18)',    // 0  青
  'rgba(0, 255, 136, 0.18)',    // 1  绿
  'rgba(255, 140, 0, 0.18)',    // 2  橙
  'rgba(168, 85, 247, 0.18)',   // 3  紫
  'rgba(255, 51, 102, 0.18)',   // 4  红
  'rgba(255, 217, 61, 0.18)',   // 5  黄
  'rgba(59, 130, 246, 0.18)',   // 6  蓝
  'rgba(236, 72, 153, 0.18)',   // 7  粉
  'rgba(20, 184, 166, 0.18)',   // 8  青绿
  'rgba(132, 204, 22, 0.18)',   // 9  黄绿
  'rgba(251, 146, 60, 0.18)',   // 10 深橙
  'rgba(139, 92, 246, 0.18)',   // 11 深紫
  'rgba(244, 63, 94, 0.18)',    // 12 玫红
  'rgba(56, 189, 248, 0.18)',   // 13 天蓝
  'rgba(163, 230, 53, 0.18)',   // 14 草绿
  'rgba(217, 119, 6, 0.18)',    // 15 琥珀
  'rgba(99, 102, 241, 0.18)',   // 16 靛蓝
  'rgba(239, 68, 68, 0.18)',    // 17 亮红
  'rgba(34, 211, 238, 0.18)',    // 18 湖蓝
  'rgba(74, 222, 128, 0.18)',   // 19 薄荷
  'rgba(245, 158, 11, 0.18)',   // 20 金色
  'rgba(167, 139, 250, 0.18)',  // 21 薰紫
  'rgba(248, 113, 113, 0.18)',  // 22 珊瑚
  'rgba(45, 212, 191, 0.18)',   // 23 碧绿
  'rgba(190, 242, 100, 0.18)',  // 24 嫩绿
  'rgba(196, 181, 253, 0.18)',  // 25 薰衣草
];

export function getWeekColor(weekLabel: string): string {
  const idx = getWeekColorIndex(weekLabel);
  return WEEK_COLORS[idx % WEEK_COLORS.length];
}

/**
 * 根据周别标签生成不同的边框颜色
 */
export function getWeekBorderColor(weekLabel: string): string {
  const idx = getWeekColorIndex(weekLabel);
  return WEEK_BORDER_COLORS[idx % WEEK_BORDER_COLORS.length];
}

/**
 * 获取所有可用的周别列表（基于项目数据中的进度日期）
 */
export function getAvailableWeeks(dates: string[]): string[] {
  const weekSet = new Set<string>();
  dates.forEach((d) => {
    if (d) weekSet.add(getWeekLabel(d));
  });
  return Array.from(weekSet).sort((a, b) => {
    const numA = parseInt(a.replace('wk', ''), 10);
    const numB = parseInt(b.replace('wk', ''), 10);
    return numB - numA; // 倒序排列：最新的周别在最前面
  });
}

/**
 * 获取所有可用的日期列表（去重排序）
 */
export function getAvailableDates(dates: string[]): string[] {
  const dateSet = new Set<string>();
  dates.forEach((d) => {
    if (d) dateSet.add(d);
  });
  return Array.from(dateSet).sort().reverse(); // 倒序排列：最新的日期在最前面
}
