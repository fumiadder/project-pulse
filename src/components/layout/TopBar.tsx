import { useState, useEffect } from 'react';
import { useUIStore } from '@/stores/useUIStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useProgressStore } from '@/stores/useProgressStore';
import { useUserStore } from '@/stores/useUserStore';
import { api } from '@/services/api';

interface TopBarProps {
  onMenuToggle: () => void;
}

const pageTitles: Record<string, string> = {
  dashboard: '控制台',
  calendar: '日历视图',
  projects: '项目管理',
  'daily-report': '日报',
  'weekly-report': '周报',
  'monthly-report': '月报',
  history: '更新记录',
  users: '用户管理',
};

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { activePage } = useUIStore();
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
    <header className="flex h-14 shrink-0 items-center border-b border-border-custom bg-bg-secondary/80 backdrop-blur-md px-4 md:px-6">
      {/* Left: Menu Toggle (mobile) */}
      <button
        onClick={onMenuToggle}
        className="mr-3 flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors md:hidden"
      >
        <i className="fas fa-bars text-base" />
      </button>

      {/* Center: Page Title */}
      <h1 className="flex-1 text-base font-semibold text-text-primary font-display tracking-wide truncate">
        {title}
      </h1>

      {/* Right: Datetime + Actions */}
      <div className="flex items-center gap-3">
        {/* Current Time */}
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-text-muted font-mono">
          <i className="far fa-clock text-accent-cyan/60" />
          {formatDate(currentTime)}
        </span>

        {/* Export Button */}
        <button
          onClick={handleExport}
          className="flex h-8 items-center gap-1.5 rounded-md border border-border-custom bg-bg-tertiary/50 px-3 text-xs text-text-secondary hover:border-accent-cyan/30 hover:text-accent-cyan transition-all"
          title="导出数据"
        >
          <i className="fas fa-file-export text-[10px]" />
          <span className="hidden sm:inline">导出</span>
        </button>
      </div>
    </header>
  );
}
