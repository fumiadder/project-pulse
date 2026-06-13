import { useUIStore } from '@/stores/useUIStore';

const bottomNavItems = [
  { key: 'dashboard', label: '控制台', icon: 'fa-th-large' },
  { key: 'calendar', label: '日历', icon: 'fa-calendar-alt' },
  { key: 'projects', label: '项目', icon: 'fa-project-diagram' },
  { key: 'daily-report', label: '日报', icon: 'fa-file-alt' },
  { key: 'private-zone', label: '私密', icon: 'fa-lock' },
] as const;

export function BottomNav() {
  const { activePage, setActivePage } = useUIStore();

  const handleNavClick = (key: string) => {
    if (key === 'more') {
      // For "more", navigate to a default page like history
      setActivePage('history');
    } else {
      setActivePage(key);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border-custom bg-bg-secondary/95 backdrop-blur-md md:hidden">
      {bottomNavItems.map((item) => {
        const isActive = activePage === item.key || (item.key === 'more' && !['dashboard', 'calendar', 'projects', 'daily-report'].includes(activePage));
        return (
          <button
            key={item.key}
            onClick={() => handleNavClick(item.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
              isActive
                ? 'text-accent-cyan'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <i
              className={`fas ${item.icon} text-base ${
                isActive ? 'text-accent-cyan' : ''
              }`}
            />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
