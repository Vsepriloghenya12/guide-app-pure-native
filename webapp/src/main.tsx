import React, { Fragment } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { BootGate } from './boot/BootGate';
import { UserAuthProvider } from './components/auth/UserAuthProvider';
import { SecretThemeProvider } from './secretTheme/SecretThemeProvider';
import './styles/theme.css';
import './styles/app.css';
import './styles/reference-rebuild.css';
import './styles/visual-polish.css';
import './styles/client-mobile-fix.css';
import './styles/client-layout-restore.css';
import './styles/owner-layout-fix.css';

function normalizeLocalDevOrigin() {
  if (typeof window === 'undefined' || !import.meta.env.DEV) {
    return;
  }

  const { hostname, protocol, port, pathname, search, hash } = window.location;
  if (protocol !== 'http:' || !['localhost', '[::1]', '0.0.0.0'].includes(hostname)) {
    return;
  }

  const canonicalUrl = `http://127.0.0.1${port ? `:${port}` : ''}${pathname}${search}${hash}`;
  window.location.replace(canonicalUrl);
}

normalizeLocalDevOrigin();

const RootMode = import.meta.env.DEV ? Fragment : React.StrictMode;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <RootMode>
    <SecretThemeProvider>
      <BootGate>
        <BrowserRouter>
          <UserAuthProvider>
            <App />
          </UserAuthProvider>
        </BrowserRouter>
      </BootGate>
    </SecretThemeProvider>
  </RootMode>
);
