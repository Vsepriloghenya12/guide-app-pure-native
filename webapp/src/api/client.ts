import type { BootstrapPayload, Category, Collection, GuideContentStore, Listing, PublicAuthSession } from '../types';
import { buildApiUrl } from './url';

async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(input), {
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers
    },
    ...init
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((data as { message?: string; error?: string })?.message || (data as { message?: string; error?: string })?.error || 'Request failed');
  }

  return data as T;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Не удалось прочитать изображение.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Ошибка чтения изображения.'));
    reader.readAsDataURL(file);
  });
}

export const api = {
  bootstrap: () => apiFetch<{ ok: true } & BootstrapPayload>('/api/bootstrap'),
  categories: () => apiFetch<{ ok: true; categories: Category[] }>('/api/categories'),
  category: (slug: string) =>
    apiFetch<{ ok: true; category: Category; filters: Array<{ config: NonNullable<Category['filterSchema']> }> }>(
      `/api/categories/${slug}`
    ),
  listings: (params?: { category?: string; search?: string; includeHidden?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.includeHidden) query.set('status', '');
    return apiFetch<{ ok: true; listings: Listing[] }>(`/api/listings?${query.toString()}`);
  },
  listing: (slug: string) =>
    apiFetch<{ ok: true; listing: Listing; category: Category; similar: Listing[] }>(`/api/listings/${slug}`),
  search: (query: string) =>
    apiFetch<{ ok: true; listings: Listing[] }>(`/api/search?q=${encodeURIComponent(query)}`),
  submitBulletinListing: (payload: {
    title: string;
    description: string;
    section: string;
    subcategory: string;
    priceLabel?: string;
    district?: string;
    phone?: string;
    link?: string;
    contactName?: string;
    imageDataUrl?: string;
    imageFileName?: string;
  }) =>
    apiFetch<{ ok: true; listing: Listing; message: string }>('/api/bulletin-submissions', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteOwnBulletin: (id: string) =>
    apiFetch<{ ok: true; deletedId: string }>(`/api/me/bulletins/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
  authSession: () => apiFetch<{ ok: true } & PublicAuthSession>('/api/auth/session'),
  userFavorites: () => apiFetch<{ ok: true; slugs: string[] }>('/api/me/favorites'),
  saveUserFavorites: (slugs: string[]) =>
    apiFetch<{ ok: true; slugs: string[] }>('/api/me/favorites', {
      method: 'PUT',
      body: JSON.stringify({ slugs })
    }),
  setUserFavorite: (slug: string, favorite: boolean) =>
    apiFetch<{ ok: true; slugs: string[] }>(`/api/me/favorites/${encodeURIComponent(slug)}`, {
      method: favorite ? 'POST' : 'DELETE'
    }),
  authLogout: () => apiFetch<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  ownerSession: () => apiFetch<{ ok: true; authenticated: boolean }>('/api/owner/session'),
  ownerLogin: (password: string) =>
    apiFetch<{ ok: true; authenticated: boolean }>('/api/owner/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    }),
  ownerLogout: () => apiFetch<{ ok: true }>('/api/owner/logout', { method: 'POST' }),
  ownerBootstrap: () =>
    apiFetch<{ ok: true; categories: Category[]; listings: Listing[]; collections: Collection[] }>(
      '/api/owner/bootstrap'
    ),
  syncDefaultContent: () =>
    apiFetch<{ ok: true; content: GuideContentStore; seedHash: string; storage: string }>(
      '/api/owner/content/sync-default',
      { method: 'POST' }
    ),
  saveListing: (
    listing: Partial<Listing> & Pick<Listing, 'categorySlug' | 'title'>,
    options?: { isNew?: boolean }
  ) => {
    const isNew = options?.isNew ?? !listing.id;

    return apiFetch<{ ok: true; listing: Listing }>(
      isNew ? '/api/owner/listings' : `/api/owner/listings/${listing.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(listing)
      }
    );
  },
  deleteListing: (id: string) =>
    apiFetch<{ ok: true }>(`/api/owner/listings/${id}`, { method: 'DELETE' }),
  saveCollectionItems: (slug: string, items: unknown[]) =>
    apiFetch<{ ok: true }>(`/api/owner/collections/${slug}/items`, {
      method: 'PUT',
      body: JSON.stringify({ items })
    }),
  uploadImage: async (file: File, options?: { kind?: 'place' | 'collection' | 'category' | 'general' | 'logo' }) => {
    const dataUrl = await fileToDataUrl(file);
    return apiFetch<{ ok: true; url: string; fileName: string; mimeType: string; sizeBytes: number }>('/api/owner/upload', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        kind: options?.kind ?? 'general',
        dataUrl
      })
    });
  }
};
