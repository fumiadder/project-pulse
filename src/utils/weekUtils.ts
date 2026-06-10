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
export function getWeekColor(weekLabel: string): string {
  // 从周标签中提取数字
  const num = parseInt(weekLabel.replace('wk', ''), 10);
  // 使用一组预定义的柔和底色
  const colors = [
    'rgba(0, 212, 255, 0.06)',   // 青色
    'rgba(0, 255, 136, 0.06)',   // 绿色
    'rgba(255, 140, 0, 0.06)',   // 橙色
    'rgba(168, 85, 247, 0.06)',  // 紫色
    'rgba(255, 51, 102, 0.06)',  // 红色
    'rgba(255, 217, 61, 0.06)',  // 黄色
    'rgba(59, 130, 246, 0.06)',  // 蓝色
    'rgba(236, 72, 153, 0.06)',  // 粉色
  ];
  return colors[num % colors.length];
}

/**
 * 根据周别标签生成不同的边框颜色
 */
export function getWeekBorderColor(weekLabel: string): string {
  const num = parseInt(weekLabel.replace('wk', ''), 10);
  const colors = [
    'rgba(0, 212, 255, 0.15)',
    'rgba(0, 255, 136, 0.15)',
    'rgba(255, 140, 0, 0.15)',
    'rgba(168, 85, 247, 0.15)',
    'rgba(255, 51, 102, 0.15)',
    'rgba(255, 217, 61, 0.15)',
    'rgba(59, 130, 246, 0.15)',
    'rgba(236, 72, 153, 0.15)',
  ];
  return colors[num % colors.length];
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
    return numA - numB;
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
  return Array.from(dateSet).sort();
}
