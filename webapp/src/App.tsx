import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireOwner } from './components/auth/RequireOwner';
import { AppShell } from './components/layout/AppShell';
import { CategoryPlaceholderPage } from './pages/CategoryPlaceholderPage';
import { HomePage } from './pages/HomePage';
import { ListingPage } from './pages/ListingPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { ContactsPage } from './pages/ContactsPage';
import { HelpPage } from './pages/HelpPage';
import { SearchPage } from './pages/SearchPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { NearbyPage } from './pages/NearbyPage';
import { MapPage } from './pages/MapPage';
import { ListingDetailPage } from './pages/ListingDetailPage';

// Owner CMS is code-split out of the public bundle: these chunks load only on /owner routes.
const OwnerShell = lazy(() =>
  import('./components/layout/OwnerShell').then((module) => ({ default: module.OwnerShell }))
);
const OwnerLoginPage = lazy(() =>
  import('./pages/OwnerLoginPage').then((module) => ({ default: module.OwnerLoginPage }))
);
const OwnerPage = lazy(() =>
  import('./pages/OwnerPage').then((module) => ({ default: module.OwnerPage }))
);

function OwnerRoutesFallback() {
  return (
    <div className="panel page-loader" style={{ margin: '48px auto', maxWidth: 420, textAlign: 'center' }}>
      Загружаю панель владельца…
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/restaurants" element={<ListingPage category="restaurants" />} />
        <Route path="/wellness" element={<ListingPage category="wellness" />} />
        <Route path="/section/:slug" element={<CategoryPlaceholderPage />} />
        <Route path="/place/:slug" element={<ListingDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/nearby" element={<NearbyPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
      </Route>

      <Route
        element={
          <Suspense fallback={<OwnerRoutesFallback />}>
            <OwnerShell />
          </Suspense>
        }
      >
        <Route path="/owner-login" element={<OwnerLoginPage />} />
        <Route
          path="/owner"
          element={
            <RequireOwner>
              <OwnerPage />
            </RequireOwner>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
