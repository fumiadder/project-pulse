import { useUIStore } from '@/stores/useUIStore';

const bottomNavItems = [
  { key: 'workbench', label: '工作台', icon: 'fa-tasks' },
  { key: 'dashboard', label: '控制台', icon: 'fa-th-large' },
  { key: 'calendar', label: '日历', icon: 'fa-calendar-alt' },
  { key: 'projects', label: '项目', icon: 'fa-project-diagram' },
  { key: 'daily-report', label: '日报', icon: 'fa-file-alt' },
] as const;

export function BottomNav() {
  const { activePage, setActivePage } = useUIStore();

  const handleNavClick = (key: string) => {
    setActivePage(key);
  };

  return (
    <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-30 flex items-stretch justify-around border-t border-border-custom bg-bg-secondary/95 backdrop-blur-md shadow-[0_-4px_12px_rgba(0,0,0,0.3)] md:hidden">
      {bottomNavItems.map((item) => {
        const isActive = activePage === item.key;
        return (
          <button
            key={item.key}
            onClick={() => handleNavClick(item.key)}
            className={`group relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-2.5 text-[10px] transition-all no-select-mobile ${
              isActive
                ? 'text-accent-cyan'
                : 'text-text-secondary/70 active:text-text-primary'
            }`}
          >
            {/* Active indicator bar at top */}
            {isActive && (
              <span className="absolute top-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-accent-cyan shadow-[0_0_8px_rgba(0,212,255,0.5)]" />
            )}
            <i
              className={`fas ${item.icon} transition-transform duration-200 ${
                isActive ? 'text-[17px] scale-110' : 'text-[15px]'
              }`}
            />
            <span className={`leading-none ${isActive ? 'font-medium' : ''}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
