import { lazy, Suspense, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { useUIStore } from '@/stores/useUIStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { ProgressEditorModal } from '@/components/modals/ProgressEditorModal';
import { seedDemoDataIfNeeded } from '@/data/seed';

// Lazy-loaded page components
const DashboardPage = lazy(() =>
  import('@/pages').then((m) => ({ default: m.DashboardPage }))
);
const CalendarPage = lazy(() =>
  import('@/pages').then((m) => ({ default: m.CalendarPage }))
);
const ProjectsPage = lazy(() =>
  import('@/pages').then((m) => ({ default: m.ProjectsPage }))
);
const DailyReportPage = lazy(() =>
  import('@/pages').then((m) => ({ default: m.DailyReportPage }))
);
const WeeklyReportPage = lazy(() =>
  import('@/pages').then((m) => ({ default: m.WeeklyReportPage }))
);
const MonthlyReportPage = lazy(() =>
  import('@/pages').then((m) => ({ default: m.MonthlyReportPage }))
);
const HistoryPage = lazy(() =>
  import('@/pages').then((m) => ({ default: m.HistoryPage }))
);
const UsersPage = lazy(() =>
  import('@/pages').then((m) => ({ default: m.UsersPage }))
);
const ProfilePage = lazy(() =>
  import('@/pages').then((m) => ({ default: m.ProfilePage }))
);

/** Loading fallback shown during lazy load */
function PageLoader() {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <i className="fas fa-spinner fa-spin text-2xl text-accent-cyan" />
        <span className="text-xs text-text-muted">加载中...</span>
      </div>
    </div>
  );
}

/** Map activePage key to lazy component */
const pageComponents: Record<string, React.LazyExoticComponent<() => ReactNode>> = {
  dashboard: DashboardPage,
  calendar: CalendarPage,
  projects: ProjectsPage,
  'daily-report': DailyReportPage,
  'weekly-report': WeeklyReportPage,
  'monthly-report': MonthlyReportPage,
  history: HistoryPage,
  users: UsersPage,
  profile: ProfilePage,
};

function App() {
  const { isLoggedIn, loadUsers } = useUserStore();
  const { activePage } = useUIStore();

  // Global ProgressEditorModal state for Ctrl+N shortcut
  const [globalProgressOpen, setGlobalProgressOpen] = useState(false);

  // On mount: load users and seed demo data
  useEffect(() => {
    const init = async () => {
      await loadUsers();
      seedDemoDataIfNeeded().catch((err) => {
        console.warn('Seed data check failed:', err);
      });
    };
    init();
  }, []);

  // Ctrl+N (or Cmd+N on Mac) keyboard shortcut to open ProgressEditorModal
  // Escape key to close any open modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      setGlobalProgressOpen(true);
    }
    if (e.key === 'Escape') {
      setGlobalProgressOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Not logged in -> show login page
  if (!isLoggedIn) {
    return <LoginPage />;
  }

  // Logged in -> show app layout with page routing
  const PageComponent = pageComponents[activePage] ?? DashboardPage;

  return (
    <>
      <AppLayout>
        <Suspense fallback={<PageLoader />}>
          <PageComponent />
        </Suspense>
      </AppLayout>

      {/* Global Progress Editor Modal (Ctrl+N) */}
      <ProgressEditorModal
        open={globalProgressOpen}
        onClose={() => setGlobalProgressOpen(false)}
      />
    </>
  );
}

export default App;
