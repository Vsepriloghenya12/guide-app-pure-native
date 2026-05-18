import { useEffect, useMemo, useState } from 'react';
import { GUIDE_CONTENT_EVENT, readGuideContent, syncGuideContentFromServer, type GuideContentScope } from '../data/guideContent';
import { isBootReady } from '../boot/bootState';
import type { GuideContentStore } from '../types';

type UseGuideContentOptions = {
  scope?: GuideContentScope;
};

function hasRenderableContent(content: GuideContentStore, scope: GuideContentScope) {
  if (scope === 'owner') {
    return content.categories.length > 0 || content.places.length > 0 || content.collections.length > 0 || content.tips.length > 0;
  }

  return content.categories.length > 0 || content.places.length > 0 || content.collections.length > 0 || content.tips.length > 0;
}

export function useGuideContent(options: UseGuideContentOptions = {}) {
  const scope = options.scope ?? 'public';
  const [content, setContent] = useState<GuideContentStore>(() => readGuideContent());
  const [loading, setLoading] = useState(() => !isBootReady() && !hasRenderableContent(readGuideContent(), scope));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const syncLocal = () => {
      if (!active) return;
      setContent(readGuideContent());
    };

    let lastSilentRefreshAt = 0;

    const load = async (background = false) => {
      const shouldBlockUI = !background && !isBootReady() && !hasRenderableContent(readGuideContent(), scope);

      if (shouldBlockUI) {
        setLoading(true);
      }
      if (shouldBlockUI) {
        setError(null);
      }
      try {
        const nextContent = await syncGuideContentFromServer(scope);
        if (!active) return;
        setContent(nextContent);
        if (shouldBlockUI) {
          setError(null);
        }
      } catch (nextError) {
        if (!active) return;
        if (shouldBlockUI) {
          setError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить контент.');
        }
      } finally {
        if (active && shouldBlockUI) {
          setLoading(false);
        }
      }
    };

    const refreshSilently = () => {
      if (!active) {
        return;
      }

      if (document.visibilityState === 'hidden') {
        return;
      }

      const now = Date.now();
      if (now - lastSilentRefreshAt < 15000) {
        return;
      }

      lastSilentRefreshAt = now;
      void load(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSilently();
      }
    };

    window.addEventListener(GUIDE_CONTENT_EVENT, syncLocal);
    window.addEventListener('storage', syncLocal);
    window.addEventListener('focus', refreshSilently);
    window.addEventListener('pageshow', refreshSilently);
    window.addEventListener('online', refreshSilently);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const refreshInterval = window.setInterval(refreshSilently, scope === 'public' ? 60000 : 120000);
    void load(hasRenderableContent(readGuideContent(), scope));

    return () => {
      active = false;
      window.removeEventListener(GUIDE_CONTENT_EVENT, syncLocal);
      window.removeEventListener('storage', syncLocal);
      window.removeEventListener('focus', refreshSilently);
      window.removeEventListener('pageshow', refreshSilently);
      window.removeEventListener('online', refreshSilently);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(refreshInterval);
    };
  }, [scope]);

  return useMemo(() => ({ ...content, loading, error }), [content, loading, error]);
}
