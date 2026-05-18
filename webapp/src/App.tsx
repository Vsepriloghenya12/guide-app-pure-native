import { Route, Routes } from 'react-router-dom';
import { RequireOwner } from './components/auth/RequireOwner';
import { AppShell } from './components/layout/AppShell';
import { OwnerShell } from './components/layout/OwnerShell';
import { CategoryPlaceholderPage } from './pages/CategoryPlaceholderPage';
import { HomePage } from './pages/HomePage';
import { ListingPage } from './pages/ListingPage';
import { OwnerLoginPage } from './pages/OwnerLoginPage';
import { OwnerPage } from './pages/OwnerPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { ContactsPage } from './pages/ContactsPage';
import { HelpPage } from './pages/HelpPage';
import { SearchPage } from './pages/SearchPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { NearbyPage } from './pages/NearbyPage';
import { MapPage } from './pages/MapPage';
import { ListingDetailPage } from './pages/ListingDetailPage';

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

      <Route element={<OwnerShell />}>
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
