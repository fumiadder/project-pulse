import { useUIStore } from '@/stores/useUIStore';
import { useUserStore } from '@/stores/useUserStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarProps {
  collapsed: boolean;
  onItemClick?: () => void;
}

const navItems = [
  { key: 'dashboard', label: '控制台', icon: 'fa-th-large' },
  { key: 'calendar', label: '日历视图', icon: 'fa-calendar-alt' },
  { key: 'projects', label: '项目管理', icon: 'fa-project-diagram' },
  { key: 'daily-report', label: '日报', icon: 'fa-file-alt' },
  { key: 'weekly-report', label: '周报', icon: 'fa-chart-bar' },
  { key: 'monthly-report', label: '月报', icon: 'fa-chart-line' },
  { key: 'history', label: '更新记录', icon: 'fa-history' },
  { key: 'users', label: '用户管理', icon: 'fa-users' },
  { key: 'private-zone', label: '私密空间', icon: 'fa-lock' },
] as const;

export function Sidebar({ collapsed, onItemClick }: SidebarProps) {
  const { activePage, setActivePage, toggleSidebar } = useUIStore();
  const { currentUser, logout, users, switchUser } = useUserStore();

  const handleNavClick = (page: string) => {
    setActivePage(page);
    onItemClick?.();
  };

  const handleLogout = () => {
    if (window.confirm('确定要退出登录吗？')) {
      logout();
    }
  };

  const handleSwitchUser = () => {
    const otherUsers = users.filter((u) => u.id !== currentUser?.id);
    if (otherUsers.length > 0) {
      switchUser(otherUsers[0].id);
    }
  };

  const sidebarContent = (
    <div
      className={`flex h-full flex-col bg-bg-secondary border-r border-border-custom transition-all duration-300 ${
        collapsed ? 'w-[60px]' : 'w-[220px]'
      }`}
    >
      {/* Logo Area */}
      <div className="flex h-16 items-center border-b border-border-custom px-4">
        {collapsed ? (
          <div className="flex w-full justify-center">
            <span className="text-accent-cyan text-lg font-bold font-display">
              PP
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-accent-cyan text-sm font-bold tracking-wider font-display">
              PROJECT PULSE
            </span>
            <span className="text-text-muted text-[10px] mt-0.5">
              项目进度管理系统
            </span>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-2">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const isActive = activePage === item.key;
            const navButton = (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                className={`group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 hover:bg-bg-tertiary ${
                  isActive
                    ? 'text-accent-cyan border-l-2 border-accent-cyan bg-bg-tertiary/50'
                    : 'text-text-secondary border-l-2 border-transparent hover:text-text-primary'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <i
                  className={`fas ${item.icon} text-base w-5 text-center ${
                    isActive ? 'text-accent-cyan' : 'text-text-muted group-hover:text-accent-cyan'
                  }`}
                />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                  <TooltipContent side="right" className="bg-bg-tertiary text-text-primary border border-border-custom">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navButton;
          })}
        </TooltipProvider>
      </nav>

      {/* Profile nav item */}
      <div className="border-t border-border-custom">
        <TooltipProvider delayDuration={0}>
          {(() => {
            const isActive = activePage === 'profile';
            const navButton = (
              <button
                onClick={() => handleNavClick('profile')}
                className={`group relative flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 hover:bg-bg-tertiary ${
                  isActive
                    ? 'text-accent-cyan border-l-2 border-accent-cyan bg-bg-tertiary/50'
                    : 'text-text-secondary border-l-2 border-transparent hover:text-text-primary'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <i
                  className={`fas fa-user-circle text-base w-5 text-center ${
                    isActive ? 'text-accent-cyan' : 'text-text-muted group-hover:text-accent-cyan'
                  }`}
                />
                {!collapsed && <span>个人中心</span>}
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                  <TooltipContent side="right" className="bg-bg-tertiary text-text-primary border border-border-custom">
                    个人中心
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navButton;
          })()}
        </TooltipProvider>
      </div>

      {/* User Section */}
      <div className="border-t border-border-custom p-3">
        {currentUser && (
          <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'gap-3'}`}>
            {/* Avatar */}
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-bg-primary"
              style={{ backgroundColor: currentUser.color }}
            >
              {currentUser.name.charAt(0)}
            </div>

            {/* User Info (hidden when collapsed) */}
            {!collapsed && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-sm text-text-primary">
                  {currentUser.name}
                </span>
                <span className="truncate text-[10px] text-text-muted">
                  {currentUser.role}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className={`flex ${collapsed ? 'gap-1' : 'gap-1 ml-auto'}`}>
              {collapsed ? (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleSwitchUser}
                        className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-bg-tertiary hover:text-accent-cyan transition-colors"
                        title="切换用户"
                      >
                        <i className="fas fa-exchange-alt text-xs" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-bg-tertiary text-text-primary border border-border-custom">
                      切换用户
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleLogout}
                        className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-bg-tertiary hover:text-accent-red transition-colors"
                        title="退出登录"
                      >
                        <i className="fas fa-sign-out-alt text-xs" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-bg-tertiary text-text-primary border border-border-custom">
                      退出登录
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <>
                  <button
                    onClick={handleSwitchUser}
                    className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-bg-tertiary hover:text-accent-cyan transition-colors"
                    title="切换用户"
                  >
                    <i className="fas fa-exchange-alt text-xs" />
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-bg-tertiary hover:text-accent-red transition-colors"
                    title="退出登录"
                  >
                    <i className="fas fa-sign-out-alt text-xs" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden md:block border-t border-border-custom p-2">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded py-2 text-text-muted hover:bg-bg-tertiary hover:text-text-primary transition-colors"
        >
          <i
            className={`fas fa-chevron-left text-xs transition-transform duration-300 ${
              collapsed ? 'rotate-180' : ''
            }`}
          />
          {!collapsed && <span className="text-xs">收起侧栏</span>}
        </button>
      </div>
    </div>
  );

  return sidebarContent;
}
