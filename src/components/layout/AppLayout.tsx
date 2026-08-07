import { useState, type ReactNode } from 'react';
import { useUIStore } from '@/stores/useUIStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

/** Floating exit button for mobile preview mode (rendered outside the phone frame) */
function MobilePreviewExitBar() {
  const { toggleMobilePreview } = useUIStore();
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="text-sm font-medium text-text-secondary">
        <i className="fas fa-mobile-alt mr-1.5 text-accent-cyan" />
        移动端预览模式
      </span>
      <button
        onClick={toggleMobilePreview}
        className="flex h-8 items-center gap-1.5 rounded-md border border-accent-cyan/40 bg-accent-cyan/10 px-3 text-xs text-accent-cyan transition-all hover:bg-accent-cyan/20"
      >
        <i className="fas fa-desktop text-[10px]" />
        <span>退出预览</span>
      </button>
    </div>
  );
}

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed, mobilePreview } = useUIStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const innerContent = (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex mobile-hide-in-preview">
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden mobile-show-in-preview"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          collapsed={false}
          onItemClick={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuToggle={() => setMobileSidebarOpen((prev) => !prev)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </>
  );

  // Mobile preview mode: wrap in a phone-like frame
  if (mobilePreview) {
    return (
      <div className="mobile-preview-container flex min-h-screen w-full flex-col items-center justify-center bg-bg-tertiary/40 p-4">
        {/* Exit bar (outside phone frame, always visible) */}
        <MobilePreviewExitBar />

        <div
          className="relative flex flex-col overflow-hidden rounded-[2rem] border-4 border-bg-secondary shadow-2xl"
          style={{ width: '375px', height: '750px', maxWidth: '100vw', maxHeight: 'calc(100vh - 60px)', transform: 'translateZ(0)' }}
        >
          {/* Notch indicator */}
          <div className="absolute left-1/2 top-0 z-[60] h-5 w-28 -translate-x-1/2 rounded-b-xl bg-bg-secondary" />

          {/* App content forced into mobile mode */}
          <div className="flex h-full w-full overflow-hidden bg-bg-primary font-body">
            {innerContent}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary font-body">
      {innerContent}
    </div>
  );
}
