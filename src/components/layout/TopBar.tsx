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
    const { projects } = useProjectStore.getState();
    const { entries } = useProgressStore.getState();
    const { users } = useUserStore.getState();
    const data = {
      projects,
      progress: entries,
      users,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-pulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Push projects to API
        if (data.projects && Array.isArray(data.projects)) {
          for (const project of data.projects) {
            await api.putProject(project);
          }
        }

        // Push progress entries to API
        if (data.progress && Array.isArray(data.progress)) {
          for (const entry of data.progress) {
            await api.putProgress(entry);
          }
        }

        // Reload stores
        await useProjectStore.getState().loadProjects();
        await useProgressStore.getState().loadProgress();
      } catch (err) {
        console.error('Import failed:', err);
        alert('导入失败，请检查文件格式是否正确。');
      }
    };
    input.click();
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

        {/* Import Button */}
        <button
          onClick={handleImport}
          className="flex h-8 items-center gap-1.5 rounded-md border border-border-custom bg-bg-tertiary/50 px-3 text-xs text-text-secondary hover:border-accent-cyan/30 hover:text-accent-cyan transition-all"
          title="导入数据"
        >
          <i className="fas fa-file-import text-[10px]" />
          <span className="hidden sm:inline">导入</span>
        </button>

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
