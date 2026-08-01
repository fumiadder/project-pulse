import { useEffect, useRef, useCallback } from 'react';
import { useTodoStore } from '@/stores/useTodoStore';
import type { Todo } from '@/types';

/**
 * 定时提醒 Hook
 *
 * 每隔 30 秒检查一次所有待办，如果某条待办的 reminderTime 已到且尚未触发过通知，
 * 则发送浏览器通知。已触发过的通知通过内存 Set 记录，避免重复提醒。
 *
 * 前端提醒仅在页面打开时生效。若需要后台提醒，需配合 Service Worker / Push API。
 */
export function useReminder() {
  const { todos } = useTodoStore();

  // 已触发提醒的 todo ID 集合（本次会话内去重）
  const triggeredRef = useRef<Set<string>>(new Set());

  /** 发送浏览器通知 */
  const sendNotification = useCallback((todo: Todo) => {
    if (!('Notification' in window)) return;

    const title = `待办提醒：${todo.title}`;
    const bodyParts: string[] = [];
    if (todo.description) bodyParts.push(todo.description.slice(0, 80));
    if (todo.dueDate) bodyParts.push(`截止日期：${todo.dueDate}`);
    if (todo.priority === 'high') bodyParts.push('优先级：高');

    const options: NotificationOptions = {
      body: bodyParts.join('\n') || '点击查看详情',
      icon: '/favicon.ico',
      tag: `todo-reminder-${todo.id}`,
      requireInteraction: false,
    };

    try {
      if (Notification.permission === 'granted') {
        new Notification(title, options);
      }
    } catch {
      // 某些浏览器在 SW 上下文外创建 Notification 会失败，静默忽略
    }
  }, []);

  /** 检查所有待办的提醒时间 */
  const checkReminders = useCallback(() => {
    const now = Date.now();

    for (const todo of todos) {
      // 跳过无提醒、已完成、已触发的
      if (!todo.reminderTime) continue;
      if (todo.status === 'completed') continue;
      if (triggeredRef.current.has(todo.id)) continue;

      const reminderTs = new Date(todo.reminderTime).getTime();
      if (isNaN(reminderTs)) continue;

      // 提醒时间已到（允许 60 秒误差）
      if (reminderTs <= now + 60_000) {
        triggeredRef.current.add(todo.id);
        sendNotification(todo);
      }
    }
  }, [todos, sendNotification]);

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
    for (const id of triggeredRef.current) {
      if (!currentIds.has(id)) {
        triggeredRef.current.delete(id);
      }
    }
  }, [todos]);
}
