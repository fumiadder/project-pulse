import { useState, useRef, useEffect, useCallback } from 'react';
import { useNotificationStore, type AppNotification } from '@/stores/useNotificationStore';

/** 通知类型对应的图标和颜色 */
const NOTIFICATION_META: Record<
  string,
  { icon: string; color: string; bg: string; label: string }
> = {
  reminder: {
    icon: 'fa-bell',
    color: 'text-accent-cyan',
    bg: 'bg-accent-cyan/10',
    label: '提醒',
  },
  overdue: {
    icon: 'fa-exclamation-triangle',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    label: '逾期',
  },
  due_today: {
    icon: 'fa-clock',
    color: 'text-accent-orange',
    bg: 'bg-accent-orange/10',
    label: '今日到期',
  },
};

/** 格式化相对时间 */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    notifications,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
  } = useNotificationStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  /** 点击外部关闭面板 */
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  /** 切换面板 */
  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  /** 点击单个通知项 */
  const handleClickNotification = useCallback(
    (notif: AppNotification) => {
      markAsRead(notif.id);
    },
    [markAsRead],
  );

  return (
    <div className="relative">
      {/* 铃铛按钮 */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-tertiary active:bg-bg-tertiary hover:text-text-primary transition-colors no-select-mobile"
        title="通知"
        aria-label="通知"
      >
        <i className={`fas ${open ? 'fa-bell' : 'fa-bell'} text-sm`} />
        {/* 未读计数徽章 */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-red px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {/* 未读时铃铛抖动提示 */}
        {unreadCount > 0 && !open && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent-red animate-pulse" />
        )}
      </button>

      {/* 下拉面板 */}
      {open && (
        <div
          ref={panelRef}
          className="fixed md:absolute left-3 right-3 md:left-auto md:right-0 top-16 md:top-full mt-0 md:mt-2 w-auto md:w-96 rounded-xl border border-border-custom bg-bg-secondary shadow-2xl z-50 overflow-hidden"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between border-b border-border-custom px-4 py-3">
            <div className="flex items-center gap-2">
              <i className="fas fa-bell text-accent-cyan text-sm" />
              <span className="text-sm font-semibold text-text-primary">
                通知中心
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-accent-red/20 px-2 py-0.5 text-[10px] font-medium text-accent-red">
                  {unreadCount} 条未读
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-text-muted hover:text-accent-cyan transition-colors"
                  title="全部标为已读"
                >
                  全部已读
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[11px] text-text-muted hover:text-accent-red transition-colors"
                  title="清空所有通知"
                >
                  清空
                </button>
              )}
            </div>
          </div>

          {/* 通知列表 */}
          <div className="max-h-[60vh] md:max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <i className="far fa-bell-slash text-3xl text-text-muted/40 mb-2" />
                <p className="text-xs text-text-muted">暂无通知</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notif) => {
                  const meta = NOTIFICATION_META[notif.type] || NOTIFICATION_META.reminder;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleClickNotification(notif)}
                      className={`group relative flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-border-custom/50 transition-colors hover:bg-bg-tertiary/50 active:bg-bg-tertiary/70 ${
                        !notif.read ? 'bg-accent-cyan/5' : ''
                      }`}
                    >
                      {/* 未读指示点 */}
                      {!notif.read && (
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-accent-cyan" />
                      )}

                      {/* 图标 */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}
                      >
                        <i className={`fas ${meta.icon} text-xs`} />
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] text-text-muted">
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-text-muted/60">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>
                        <p
                          className={`text-xs leading-relaxed truncate ${
                            notif.read
                              ? 'text-text-muted'
                              : 'text-text-primary font-medium'
                          }`}
                        >
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                            {notif.body}
                          </p>
                        )}
                      </div>

                      {/* 删除按钮（hover 显示） */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notif.id);
                        }}
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded text-text-muted opacity-0 group-hover:opacity-100 group-active:opacity-100 hover:text-accent-red transition-all"
                        title="删除"
                      >
                        <i className="fas fa-times text-[10px]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
