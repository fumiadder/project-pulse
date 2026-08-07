import { useState, useEffect } from 'react';
import { useUIStore } from '@/stores/useUIStore';
import { NotificationCenter } from './NotificationCenter';

interface TopBarProps {
  onMenuToggle: () => void;
}

const pageTitles: Record<string, string> = {
  dashboard: '控制台',
  workbench: '个人工作台',
  calendar: '日历视图',
  projects: '项目管理',
  'daily-report': '日报',
  'weekly-report': '周报',
  'monthly-report': '月报',
  history: '更新记录',
  users: '用户管理',
  'private-zone': '私密空间',
  profile: '个人中心',
};

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { activePage, mobilePreview, toggleMobilePreview } = useUIStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const title = pageTitles[activePage] || activePage;

  const handleExport = async () => {
    try {
      const response = await fetch('/api/export/excel');
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-pulse-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  return (
    <header className="mobile-header-h flex h-14 shrink-0 items-center border-b border-border-custom bg-bg-secondary/80 backdrop-blur-md px-3 md:px-6 safe-area-top">
      {/* Left: Menu Toggle (mobile only) */}
      <button
        onClick={onMenuToggle}
        className="mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-tertiary active:bg-bg-tertiary hover:text-text-primary transition-colors md:hidden no-select-mobile"
        aria-label="打开菜单"
      >
        <i className="fas fa-bars text-base" />
      </button>

      {/* Center: Page Title */}
      <h1 className="flex-1 text-base font-semibold text-text-primary font-display tracking-wide truncate min-w-0">
        {title}
      </h1>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        {/* Mobile Preview Toggle (desktop only) */}
        <button
          onClick={toggleMobilePreview}
          className={`hidden md:flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs transition-all ${
            mobilePreview
              ? 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan'
              : 'border-border-custom bg-bg-tertiary/50 text-text-secondary hover:border-accent-cyan/30 hover:text-accent-cyan'
          }`}
          title={mobilePreview ? '退出移动端预览' : '移动端预览'}
        >
          <i className={`fas ${mobilePreview ? 'fa-desktop' : 'fa-mobile-alt'} text-[10px]`} />
          <span className="hidden sm:inline">{mobilePreview ? '桌面' : '移动端'}</span>
        </button>

        {/* Current Time (desktop only) */}
        <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-text-muted font-mono">
          <i className="far fa-clock text-accent-cyan/60" />
          {formatDate(currentTime)}
        </span>

        {/* Export Button - icon only on mobile */}
        <button
          onClick={handleExport}
          className="flex h-9 w-9 md:w-auto items-center justify-center gap-1.5 rounded-lg border border-border-custom bg-bg-tertiary/50 md:px-3 text-xs text-text-secondary hover:border-accent-cyan/30 hover:text-accent-cyan transition-all no-select-mobile"
          title="导出数据"
          aria-label="导出数据"
        >
          <i className="fas fa-file-export text-[10px]" />
          <span className="hidden md:inline">导出</span>
        </button>

        {/* Notification Center (Bell Icon) */}
        <NotificationCenter />
      </div>
    </header>
  );
}
