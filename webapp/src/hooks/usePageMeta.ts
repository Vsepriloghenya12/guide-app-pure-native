import { useEffect } from 'react';

type PageMetaOptions = {
  title: string;
  description?: string;
};

const APP_NAME = 'Danang Guide';
const DEFAULT_DESCRIPTION = 'Гид по местам, маршрутам, ресторанам, событиям и отдыху в Дананге.';

function ensureMeta(selector: string, attrs: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    Object.entries(attrs).forEach(([key, value]) => element?.setAttribute(key, value));
    document.head.appendChild(element);
  }
  return element;
}

export function usePageMeta({ title, description }: PageMetaOptions) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const fullTitle = title === APP_NAME ? APP_NAME : `${title} — ${APP_NAME}`;
    const finalDescription = description || DEFAULT_DESCRIPTION;

    document.title = fullTitle;

    ensureMeta('meta[name="description"]', { name: 'description' }).setAttribute('content', finalDescription);
    ensureMeta('meta[property="og:title"]', { property: 'og:title' }).setAttribute('content', fullTitle);
    ensureMeta('meta[property="og:description"]', { property: 'og:description' }).setAttribute('content', finalDescription);
    ensureMeta('meta[property="og:type"]', { property: 'og:type' }).setAttribute('content', 'website');
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card' }).setAttribute('content', 'summary_large_image');
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title' }).setAttribute('content', fullTitle);
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description' }).setAttribute('content', finalDescription);
  }, [title, description]);
}
