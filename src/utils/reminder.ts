// ============================================
// 提醒配置工具函数 — 共享于 TodoEditorModal 和 useReminder hook
// ============================================

/** 提醒配置类型 */
export type ReminderType = 'none' | 'once' | 'daily' | 'interval';

export interface ReminderConfig {
  type: ReminderType;
  datetime?: string;        // once: ISO 字符串
  time?: string;            // daily: "HH:MM"
  intervalMinutes?: number; // interval: 分钟数
}

/** 解析 reminderTime 字段（兼容旧版 ISO 字符串） */
export function parseReminderConfig(raw: string | null | undefined): ReminderConfig {
  if (!raw) return { type: 'none' };
  // 尝试解析 JSON
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.type) {
      return parsed as ReminderConfig;
    }
  } catch {
    // 旧版格式：ISO 字符串，转为 once 类型
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return { type: 'once', datetime: raw };
    }
  }
  return { type: 'none' };
}

/** 将 ReminderConfig 序列化为字符串 */
export function serializeReminderConfig(config: ReminderConfig): string | null {
  if (config.type === 'none') return null;
  return JSON.stringify(config);
}

/** 获取提醒的人类可读描述 */
export function getReminderLabel(raw: string | null | undefined): string {
  const config = parseReminderConfig(raw);
  switch (config.type) {
    case 'once':
      if (!config.datetime) return '';
      const d = new Date(config.datetime);
      if (isNaN(d.getTime())) return '';
      return `指定时间 ${d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    case 'daily':
      return `每天 ${config.time || '00:00'} 提醒`;
    case 'interval':
      const mins = config.intervalMinutes || 0;
      if (mins >= 60 && mins % 60 === 0) {
        return `每隔 ${mins / 60} 小时提醒`;
      }
      return `每隔 ${mins} 分钟提醒`;
    default:
      return '';
  }
}

/** ISO 字符串转 datetime-local 输入值 */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local 输入值转 ISO 字符串 */
export function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
