import { useEffect, useRef, useCallback } from 'react';
import { useTodoStore } from '@/stores/useTodoStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { api } from '@/services/api';
import { parseReminderConfig } from '@/utils/reminder';
import type { Todo } from '@/types';

/**
 * 定时提醒 Hook
 *
 * 支持三种提醒类型：
 * - once: 指定时间提醒一次
 * - daily: 每天固定时间提醒
 * - interval: 每隔 N 分钟/小时提醒
 *
 * 每隔 30 秒检查一次所有待办，使用 Map 记录每个 todo 的上次触发时间戳。
 * 同时发送浏览器通知、推送到右上角通知中心、以及飞书消息提醒。
 */
export function useReminder() {
  const { todos } = useTodoStore();
  const { addNotification } = useNotificationStore();

  // 记录每个 todo 的上次触发时间戳（用于 interval/daily 去重）
  // once 类型触发后标记为 -1 表示不再触发
  const lastTriggeredRef = useRef<Map<string, number>>(new Map());

  // 飞书提醒：服务器自动从 settings 读取凭证和 open_id，前端只需调用
  /** 发送飞书消息提醒 */
  const sendFeishuNotification = useCallback(async (todo: Todo) => {
    const title = `待办提醒：${todo.title}`;
    const bodyParts: string[] = [];
    // 提取纯文本描述
    if (todo.description) {
      const temp = document.createElement('div');
      temp.innerHTML = todo.description;
      const text = (temp.textContent || '').trim();
      if (text) bodyParts.push(text.slice(0, 80));
    }
    if (todo.dueDate) bodyParts.push(`截止日期：${todo.dueDate}`);
    if (todo.priority === 'high') bodyParts.push('优先级：高');
    if (todo.category) bodyParts.push(`分类：${todo.category}`);

    try {
      await api.sendFeishuNotify(title, bodyParts.join('\n'));
    } catch {
      // 忽略错误，不影响其他提醒渠道
    }
  }, []);

  /** 发送浏览器通知 */
  const sendBrowserNotification = useCallback((todo: Todo) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const title = `待办提醒：${todo.title}`;
    const bodyParts: string[] = [];
    // 提取纯文本描述
    if (todo.description) {
      const temp = document.createElement('div');
      temp.innerHTML = todo.description;
      const text = (temp.textContent || '').trim();
      if (text) bodyParts.push(text.slice(0, 80));
    }
    if (todo.dueDate) bodyParts.push(`截止日期：${todo.dueDate}`);
    if (todo.priority === 'high') bodyParts.push('优先级：高');

    const options: NotificationOptions = {
      body: bodyParts.join('\n') || '点击查看详情',
      icon: '/favicon.ico',
      tag: `todo-reminder-${todo.id}`,
      requireInteraction: false,
    };

    try {
      new Notification(title, options);
    } catch {
      // 某些浏览器在 SW 上下文外创建 Notification 会失败，静默忽略
    }
  }, []);

  /** 推送通知到通知中心 */
  const pushNotification = useCallback((todo: Todo) => {
    const config = parseReminderConfig(todo.reminderTime);
    let reminderLabel = '';
    if (config.type === 'once') reminderLabel = '定时提醒';
    else if (config.type === 'daily') reminderLabel = '每日提醒';
    else if (config.type === 'interval') reminderLabel = '间隔提醒';

    // 构建通知内容
    const bodyParts: string[] = [];
    if (todo.dueDate) bodyParts.push(`截止日期：${todo.dueDate}`);
    if (todo.priority === 'high') bodyParts.push('优先级：高');
    if (todo.category) bodyParts.push(`分类：${todo.category}`);

    addNotification({
      type: 'reminder',
      title: `${reminderLabel}：${todo.title}`,
      body: bodyParts.join(' · ') || '请查看待办详情',
      todoId: todo.id,
    });
  }, [addNotification]);

  /** 检查单个 todo 是否应该触发提醒 */
  const shouldTrigger = useCallback((todo: Todo, now: number): boolean => {
    if (!todo.reminderTime) return false;
    if (todo.status === 'completed') return false;

    const config = parseReminderConfig(todo.reminderTime);
    if (config.type === 'none') return false;

    const lastTs = lastTriggeredRef.current.get(todo.id);

    switch (config.type) {
      case 'once': {
        // once 类型：触发一次后不再重复（lastTs === -1 表示已触发）
        if (lastTs === -1) return false;
        if (!config.datetime) return false;
        const targetTs = new Date(config.datetime).getTime();
        if (isNaN(targetTs)) return false;
        // 提醒时间已到（允许 60 秒误差）
        if (targetTs <= now + 60_000) {
          return true;
        }
        return false;
      }

      case 'daily': {
        // daily 类型：每天在指定 HH:MM 触发一次
        if (!config.time) return false;
        const [h, m] = config.time.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return false;
        const nowDate = new Date(now);
        // 当前时间是否匹配（允许 60 秒误差，即检查分钟级别）
        const currentH = nowDate.getHours();
        const currentM = nowDate.getMinutes();
        if (currentH !== h || currentM !== m) return false;
        // 检查今天是否已经触发过
        if (lastTs !== undefined && lastTs > 0) {
          const lastDate = new Date(lastTs);
          // 同一天同一小时同一分钟已经触发过，跳过
          if (
            lastDate.getFullYear() === nowDate.getFullYear() &&
            lastDate.getMonth() === nowDate.getMonth() &&
            lastDate.getDate() === nowDate.getDate() &&
            lastDate.getHours() === currentH &&
            lastDate.getMinutes() === currentM
          ) {
            return false;
          }
        }
        return true;
      }

      case 'interval': {
        // interval 类型：每隔 N 分钟触发一次
        const intervalMs = (config.intervalMinutes || 0) * 60 * 1000;
        if (intervalMs <= 0) return false;
        // 如果从未触发过，立即触发
        if (lastTs === undefined || lastTs === -1) {
          // 但需要检查 todo 创建时间，避免刚创建就触发
          const createdTs = new Date(todo.createdAt).getTime();
          if (now - createdTs < intervalMs) return false;
          return true;
        }
        // 检查是否已经过了间隔时间
        if (now - lastTs >= intervalMs) {
          return true;
        }
        return false;
      }

      default:
        return false;
    }
  }, []);

  /** 检查所有待办的提醒时间 */
  const checkReminders = useCallback(() => {
    const now = Date.now();

    for (const todo of todos) {
      if (shouldTrigger(todo, now)) {
        const config = parseReminderConfig(todo.reminderTime);
        // once 类型触发后标记 -1 不再重复
        if (config.type === 'once') {
          lastTriggeredRef.current.set(todo.id, -1);
        } else {
          lastTriggeredRef.current.set(todo.id, now);
        }
        // 同时发送浏览器通知、推送通知中心、飞书消息
        sendBrowserNotification(todo);
        pushNotification(todo);
        sendFeishuNotification(todo);
      }
    }
  }, [todos, shouldTrigger, sendBrowserNotification, pushNotification, sendFeishuNotification]);

  // 请求通知权限（仅一次）
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // 不自动请求，等用户在编辑器中主动点击
      // 但如果之前已授权，则保持
    }
  }, []);

  // 定时检查（每 30 秒）
  useEffect(() => {
    // 立即检查一次
    checkReminders();

    const interval = setInterval(checkReminders, 30_000);
    return () => clearInterval(interval);
  }, [checkReminders]);

  // 页面可见性变化时也检查一次
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        checkReminders();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [checkReminders]);

  // 清理已删除 todo 的触发记录
  useEffect(() => {
    const currentIds = new Set(todos.map((t) => t.id));
    for (const id of lastTriggeredRef.current.keys()) {
      if (!currentIds.has(id)) {
        lastTriggeredRef.current.delete(id);
      }
    }
  }, [todos]);
}
