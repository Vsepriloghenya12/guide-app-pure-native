import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from 'react';

type SecretThemeManifest = {
  id: string;
  name: string;
  cssPath: string;
  logoSrc?: string;
  logoAlt?: string;
  backgroundSrc?: string;
};

type SecretThemeContextValue = {
  isActive: boolean;
  isAvailable: boolean;
  manifest: SecretThemeManifest | null;
  registerLogoTap: () => void;
  activateSecretTheme: () => Promise<boolean>;
  deactivateSecretTheme: () => void;
};

const SecretThemeContext = createContext<SecretThemeContextValue | null>(null);

const STORAGE_KEY = 'guide-secret-theme-active';
const TAP_WINDOW_MS = 8000;
const TAP_THRESHOLD = 10;
const MANIFEST_URL = '/secret-theme/manifest.json';
const LINK_ID = 'secret-theme-css';

function resolveThemePath(path: string | undefined, fallback: string) {
  if (!path) {
    return fallback;
  }

  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
    return path;
  }

  return `/secret-theme/${path.replace(/^\.\//, '').replace(/^\//, '')}`;
}

function injectCss(cssPath: string) {
  if (typeof document === 'undefined') {
    return;
  }

  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  if (link.href !== new URL(cssPath, window.location.origin).toString()) {
    link.href = cssPath;
  }
}

function removeCss() {
  if (typeof document === 'undefined') {
    return;
  }

  const link = document.getElementById(LINK_ID);
  if (link) {
    link.remove();
  }
}

function applyBodyState(manifest: SecretThemeManifest | null, active: boolean) {
  if (typeof document === 'undefined') {
    return;
  }

  document.body.classList.toggle('secret-theme-active', active && Boolean(manifest));
  if (active && manifest) {
    document.body.dataset.secretThemeId = manifest.id;
  } else {
    delete document.body.dataset.secretThemeId;
  }
}

async function loadManifest(): Promise<SecretThemeManifest | null> {
  try {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const raw = (await response.json()) as Partial<SecretThemeManifest>;
    if (!raw.id || !raw.name) {
      return null;
    }

    return {
      id: raw.id,
      name: raw.name,
      cssPath: resolveThemePath(raw.cssPath, '/secret-theme/theme.css'),
      logoSrc: resolveThemePath(raw.logoSrc, '/secret-theme/logo-demon-guide.png'),
      logoAlt: raw.logoAlt || 'Секретный логотип Danang Guide',
      backgroundSrc: resolveThemePath(raw.backgroundSrc, '/secret-theme/secret-bg.png')
    };
  } catch {
    return null;
  }
}

export function SecretThemeProvider({ children }: PropsWithChildren) {
  const [manifest, setManifest] = useState<SecretThemeManifest | null>(null);
  const [isActive, setIsActive] = useState(false);
  const tapRef = useRef<number[]>([]);

  const activateSecretTheme = useCallback(async () => {
    const loaded = manifest ?? (await loadManifest());
    if (!loaded) {
      setManifest(null);
      setIsActive(false);
      removeCss();
      applyBodyState(null, false);
      window.localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    setManifest(loaded);
    injectCss(loaded.cssPath);
    applyBodyState(loaded, true);
    setIsActive(true);
    window.localStorage.setItem(STORAGE_KEY, loaded.id);
    return true;
  }, [manifest]);

  const deactivateSecretTheme = useCallback(() => {
    setIsActive(false);
    removeCss();
    applyBodyState(null, false);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const registerLogoTap = useCallback(() => {
    const now = Date.now();
    tapRef.current = tapRef.current.filter((stamp) => now - stamp < TAP_WINDOW_MS);
    tapRef.current.push(now);

    if (tapRef.current.length >= TAP_THRESHOLD) {
      tapRef.current = [];
      if (isActive) {
        deactivateSecretTheme();
      } else {
        void activateSecretTheme();
      }
    }
  }, [activateSecretTheme, deactivateSecretTheme, isActive]);

  useEffect(() => {
    let cancelled = false;
    const shouldRestore = window.localStorage.getItem(STORAGE_KEY);
    if (!shouldRestore) {
      return () => {
        cancelled = true;
      };
    }

    void loadManifest().then((loaded) => {
      if (cancelled) {
        return;
      }

      if (!loaded) {
        window.localStorage.removeItem(STORAGE_KEY);
        removeCss();
        applyBodyState(null, false);
        setManifest(null);
        setIsActive(false);
        return;
      }

      setManifest(loaded);
      injectCss(loaded.cssPath);
      applyBodyState(loaded, true);
      setIsActive(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isActive && manifest) {
      injectCss(manifest.cssPath);
      applyBodyState(manifest, true);
      return;
    }

    if (!isActive) {
      applyBodyState(null, false);
    }
  }, [isActive, manifest]);

  const value = useMemo<SecretThemeContextValue>(
    () => ({
      isActive,
      isAvailable: Boolean(manifest) || typeof window !== 'undefined',
      manifest,
      registerLogoTap,
      activateSecretTheme,
      deactivateSecretTheme
    }),
    [activateSecretTheme, isActive, manifest, registerLogoTap, deactivateSecretTheme]
  );

  return <SecretThemeContext.Provider value={value}>{children}</SecretThemeContext.Provider>;
}

export function useSecretTheme() {
  const context = useContext(SecretThemeContext);
  if (!context) {
    throw new Error('useSecretTheme must be used inside SecretThemeProvider');
  }

  return context;
}
