import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { BottomNav } from './BottomNav';
import { getAnalyticsLabelByPath, recordGuideAnalytics } from '../../utils/analytics';

export function AppShell() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (location.pathname.startsWith('/owner')) {
      return;
    }

    recordGuideAnalytics({
      kind: 'page-view',
      label: getAnalyticsLabelByPath(location.pathname),
      path: location.pathname
    });
  }, [location.pathname]);

  return (
    <div className="app-shell reference-shell">
      <main className="app-main reference-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
