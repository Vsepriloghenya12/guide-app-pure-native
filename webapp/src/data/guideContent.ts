import { defaultGuideContent } from './mockData';
import { defaultCategories } from './categories';
import type { GuideCategory, GuideContentStore, GuidePlace } from '../types';
import { notifyOwnerAuthRequired } from '../utils/ownerEvents';
import { formatOpeningHours } from '../utils/places';
import { buildApiUrl } from '../api/url';

const GUIDE_CONTENT_KEY = 'guide-content-store-v4';
const LEGACY_GUIDE_CONTENT_KEY = 'guide-content-store-v2';
const GUIDE_CONTENT_PENDING_KEY = 'guide-content-store-v4-pending';
const GUIDE_CONTENT_PUBLIC_ENDPOINT = '/api/public/content';
const GUIDE_CONTENT_OWNER_ENDPOINT = '/api/owner/bootstrap';
const GUIDE_CONTENT_WRITE_ENDPOINT = '/api/content';
const GUIDE_CONTENT_RESET_ENDPOINT = '/api/content/reset';

export const GUIDE_CONTENT_EVENT = 'guide-content-updated';

let persistQueue: Promise<GuideContentStore | null> | null = null;
let queuedPersistStore: GuideContentStore | null = null;
let serverSyncPromises: Partial<Record<GuideContentScope, Promise<GuideContentStore>>> = {};
let lastLocalWriteAt = 0;
let lastLocalWriteVersion = 0;

export type GuideContentScope = 'public' | 'owner';

const categoryLabelOverrides: Partial<Record<GuideCategory['id'], { title: string; shortTitle: string }>> = {
  restaurants: { title: 'Еда', shortTitle: 'Еда' },
  wellness: { title: 'Оздоровление', shortTitle: 'Оздоровление' },
  hotels: { title: 'Резорты', shortTitle: 'Резорты' },
  'car-rental': { title: 'Транспорт', shortTitle: 'Транспорт' },
  atm: { title: 'Финансы', shortTitle: 'Финансы' },
  shops: { title: 'Покупки', shortTitle: 'Покупки' },
  'photo-spots': { title: 'Виды города', shortTitle: 'Виды города' }
};

function cloneRawDefaultStore(): GuideContentStore {
  return JSON.parse(JSON.stringify(defaultGuideContent)) as GuideContentStore;
}

function normalizeLegacyShopsLabel(value: string | undefined, categoryId: string | undefined) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  return categoryId === 'shops' && normalized.toLowerCase() === 'магазины' ? 'Покупки' : normalized;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function hasPendingPersist() {
  return canUseStorage() && window.localStorage.getItem(GUIDE_CONTENT_PENDING_KEY) === '1';
}

function markPendingPersist() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(GUIDE_CONTENT_PENDING_KEY, '1');
}

function clearPendingPersist() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(GUIDE_CONTENT_PENDING_KEY);
}

function markLocalWrite() {
  lastLocalWriteAt = Date.now();
  lastLocalWriteVersion += 1;
}

function createMigratedPlace(item: {
  id: string;
  title: string;
  address: string;
  description: string;
  imageLabel?: string;
  avgCheck?: number;
  kind?: string;
  cuisine?: string;
  breakfast?: boolean;
  vegan?: boolean;
  pets?: boolean;
  services?: string[];
  childPrograms?: boolean;
}): GuidePlace {
  return {
    id: item.id,
    categoryId: item.services ? 'wellness' : 'restaurants',
    title: item.title,
    description: item.description,
    address: item.address,
    phone: '',
    website: '',
    hours: '',
    avgCheck: item.avgCheck,
    kind: item.kind ?? '',
    cuisine: item.cuisine ?? '',
    services: item.services ?? [],
    tags: [],
    breakfast: item.breakfast ?? false,
    vegan: item.vegan ?? false,
    pets: item.pets ?? false,
    childPrograms: item.childPrograms ?? false,
    top: false,
    imageLabel: item.imageLabel ?? 'Карточка',
    imageSrc: '',
    imageGallery: []
  };
}

function migrateLegacyStore(raw: string): GuideContentStore | null {
  try {
    const legacy = JSON.parse(raw) as {
      restaurants?: Array<{
        id: string;
        title: string;
        address: string;
        description: string;
        imageLabel?: string;
        avgCheck?: number;
        kind?: string;
        cuisine?: string;
        breakfast?: boolean;
        vegan?: boolean;
        pets?: boolean;
      }>;
      wellness?: Array<{
        id: string;
        title: string;
        address: string;
        description: string;
        imageLabel?: string;
        services?: string[];
        childPrograms?: boolean;
      }>;
    };

    return normalizeStore({
      ...cloneRawDefaultStore(),
      places: [
        ...(legacy.restaurants ?? []).map((item) =>
          createMigratedPlace({
            ...item,
            kind: item.kind,
            cuisine: item.cuisine
          })
        ),
        ...(legacy.wellness ?? []).map((item) => createMigratedPlace(item))
      ]
    });
  } catch {
    return null;
  }
}

function normalizeCategory(category: Partial<GuideCategory>, fallback: GuideCategory): GuideCategory {
  const labels = categoryLabelOverrides[(category.id ?? fallback.id) as GuideCategory['id']];

  return {
    ...fallback,
    ...category,
    title: labels?.title ?? category.title ?? fallback.title,
    visible: category.visible ?? fallback.visible,
    showOnHome: category.showOnHome ?? fallback.showOnHome,
    slug: category.slug ?? fallback.slug ?? fallback.id,
    shortTitle: labels?.shortTitle ?? category.shortTitle ?? fallback.shortTitle ?? fallback.title,
    accent: category.accent ?? fallback.accent ?? 'coast',
    imageSrc: category.imageSrc ?? fallback.imageSrc ?? '',
    sortOrder: category.sortOrder ?? fallback.sortOrder ?? 100,
    filterSchema: {
      quickFilters: category.filterSchema?.quickFilters ?? fallback.filterSchema?.quickFilters ?? [],
      fields: category.filterSchema?.fields ?? fallback.filterSchema?.fields ?? []
    }
  };
}

function normalizePlace(place: GuidePlace): GuidePlace {
  const { rating: _legacyRating, ...normalizedInput } = place as GuidePlace & { rating?: number };
  const gallery = Array.isArray(place.imageGallery)
    ? place.imageGallery.filter((image): image is string => Boolean(image))
    : place.imageSrc
      ? [place.imageSrc]
      : [];

  const imageUrls = Array.isArray(place.imageUrls)
    ? place.imageUrls.filter((image): image is string => Boolean(image))
    : gallery;

  const categorySlug = place.categorySlug ?? place.categoryId;
  const slug = place.slug ?? `${categorySlug}-${place.id}`;
  const coverImageUrl = place.coverImageUrl ?? place.imageSrc ?? imageUrls[0] ?? '';
  const normalizedHours = formatOpeningHours(place.hours);

  return {
    ...normalizedInput,
    imageGallery: gallery,
    imageSrc: place.imageSrc ?? '',
    hotelStars: typeof place.hotelStars === 'number' ? place.hotelStars : null,
    hotelPool: place.hotelPool ?? false,
    hotelSpa: place.hotelSpa ?? false,
    slug,
    categorySlug,
    featured: place.featured ?? place.top ?? false,
    shortDescription: place.shortDescription ?? place.description,
    priceLabel: place.priceLabel ?? (typeof place.avgCheck === 'number' ? `от ${place.avgCheck}` : ''),
    listingType: normalizeLegacyShopsLabel(place.listingType ?? place.kind ?? '', place.categoryId),
    childFriendly: place.childFriendly ?? place.childPrograms ?? false,
    petFriendly: place.petFriendly ?? place.pets ?? false,
    mapQuery: place.mapQuery ?? place.address ?? '',
    extra: Array.isArray(place.extra) ? place.extra : place.services ?? [],
    imageUrls,
    coverImageUrl,
    websiteUrl: place.websiteUrl ?? place.website ?? '',
    phoneNumber: place.phoneNumber ?? place.phone ?? '',
    district: place.district ?? '',
    location: place.location ?? place.address ?? '',
    hours: normalizedHours,
    type: normalizeLegacyShopsLabel(place.type ?? place.kind ?? '', place.categoryId),
    contactName: place.contactName ?? '',
    createdByUserId: place.createdByUserId ?? ''
  };
}

function normalizeStore(parsed: Partial<GuideContentStore>): GuideContentStore {
  const rawDefaults = cloneRawDefaultStore();
  const normalizedDefaultCategories = defaultCategories.map((fallback) => normalizeCategory(fallback, fallback));
  const normalizedDefaultPlaces = (Array.isArray(rawDefaults.places) ? rawDefaults.places : []).map(normalizePlace);
  const parsedPlaces = Array.isArray(parsed.places) ? parsed.places : [];
  const useDefaultSeedContent = parsedPlaces.length === 0;
  const places = useDefaultSeedContent ? normalizedDefaultPlaces : parsedPlaces.map(normalizePlace);

  const categories = (() => {
    if (!Array.isArray(parsed.categories)) {
      return normalizedDefaultCategories;
    }

    const parsedCategoryMap = new Map(parsed.categories.map((category) => [category.id, category]));
    const usedIds = new Set<string>();
    const mergedDefaults = defaultCategories.map((fallback) => {
      const found = parsedCategoryMap.get(fallback.id);
      usedIds.add(fallback.id);
      return normalizeCategory(found ?? fallback, fallback);
    });
    const customCategories = parsed.categories
      .filter((category): category is GuideCategory => Boolean(category?.id) && !usedIds.has(category.id))
      .map((category) => normalizeCategory(category, category));

    return [...mergedDefaults, ...customCategories].sort((left, right) => (left.sortOrder ?? 100) - (right.sortOrder ?? 100) || left.title.localeCompare(right.title, 'ru'));
  })();

  return {
    version: 4,
    places,
    restaurants: places.filter((place) => place.categoryId === 'restaurants'),
    wellness: places.filter((place) => place.categoryId === 'wellness'),
    categories,
    tips: useDefaultSeedContent ? rawDefaults.tips : Array.isArray(parsed.tips) ? parsed.tips : rawDefaults.tips,
    collections: useDefaultSeedContent ? rawDefaults.collections : Array.isArray(parsed.collections) ? parsed.collections : rawDefaults.collections,
    home: {
      popularPlaceIds: useDefaultSeedContent ? rawDefaults.home.popularPlaceIds : parsed.home?.popularPlaceIds ?? rawDefaults.home.popularPlaceIds,
      featuredCategoryIds: useDefaultSeedContent ? rawDefaults.home.featuredCategoryIds : parsed.home?.featuredCategoryIds ?? rawDefaults.home.featuredCategoryIds,
      tipIds: useDefaultSeedContent ? rawDefaults.home.tipIds : parsed.home?.tipIds ?? rawDefaults.home.tipIds,
      collectionIds: useDefaultSeedContent ? rawDefaults.home.collectionIds : parsed.home?.collectionIds ?? rawDefaults.home.collectionIds,
      logoMedia: parsed.home?.logoMedia?.src
        ? {
            type: parsed.home.logoMedia.type === 'video' ? 'video' : 'image',
            src: parsed.home.logoMedia.src,
            posterSrc: parsed.home.logoMedia.posterSrc || '',
            alt: parsed.home.logoMedia.alt || ''
          }
        : rawDefaults.home?.logoMedia?.src
          ? {
              type: rawDefaults.home.logoMedia.type === 'video' ? 'video' : 'image',
              src: rawDefaults.home.logoMedia.src,
              posterSrc: rawDefaults.home.logoMedia.posterSrc || '',
              alt: rawDefaults.home.logoMedia.alt || ''
            }
          : undefined,
      sectionTitles: {
        popular: parsed.home?.sectionTitles?.popular ?? rawDefaults.home.sectionTitles.popular,
        categories: parsed.home?.sectionTitles?.categories ?? rawDefaults.home.sectionTitles.categories,
        tips: parsed.home?.sectionTitles?.tips ?? rawDefaults.home.sectionTitles.tips,
        collections: parsed.home?.sectionTitles?.collections ?? rawDefaults.home.sectionTitles.collections,
        allCategories: parsed.home?.sectionTitles?.allCategories ?? rawDefaults.home.sectionTitles.allCategories
      }
    },
    analytics: {
      events: Array.isArray(parsed.analytics?.events)
        ? parsed.analytics.events.filter((event): event is NonNullable<typeof event> => Boolean(event)).slice(-400)
        : rawDefaults.analytics?.events ?? []
    }
  };
}

function cloneDefaultStore(): GuideContentStore {
  return normalizeStore(cloneRawDefaultStore());
}

function emitGuideContentUpdate() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(GUIDE_CONTENT_EVENT));
}

async function fetchContentFromServer(scope: GuideContentScope = 'public'): Promise<GuideContentStore> {
  const endpoint = scope === 'owner' ? GUIDE_CONTENT_OWNER_ENDPOINT : GUIDE_CONTENT_PUBLIC_ENDPOINT;
  const response = await fetch(buildApiUrl(endpoint), {
    credentials: 'include',
    cache: 'no-store'
  });

  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; content?: GuideContentStore; message?: string };

  if (!response.ok || !payload.content) {
    throw new Error(payload.message || 'Не удалось загрузить контент с сервера.');
  }

  return normalizeStore(payload.content);
}

function mergePublicClientState(remoteStore: GuideContentStore, localStore: GuideContentStore) {
  return normalizeStore({
    ...remoteStore,
    analytics: localStore.analytics
  });
}

async function pushContentToServer(store: GuideContentStore) {
  const response = await fetch(buildApiUrl(GUIDE_CONTENT_WRITE_ENDPOINT), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: store })
  });

  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; content?: GuideContentStore; message?: string };

  if (!response.ok || !payload.content) {
    if (response.status === 401) {
      notifyOwnerAuthRequired();
    }
    throw new Error(payload.message || 'Не удалось сохранить контент в PostgreSQL.');
  }

  return normalizeStore(payload.content);
}

async function flushPersistQueue() {
  let lastRemoteStore: GuideContentStore | null = null;

  while (queuedPersistStore) {
    const storeToPersist = queuedPersistStore;
    const persistStartedVersion = lastLocalWriteVersion;
    queuedPersistStore = null;

    try {
      const remoteStore = await pushContentToServer(storeToPersist);

      if (queuedPersistStore || lastLocalWriteVersion > persistStartedVersion) {
        lastRemoteStore = readGuideContent();
        continue;
      }

      lastRemoteStore = writeGuideContent(remoteStore, { persist: false, emit: true, source: 'remote' });
    } catch (error) {
      queuedPersistStore = storeToPersist;
      throw error;
    }
  }

  clearPendingPersist();
  return lastRemoteStore;
}

function queuePersist(store: GuideContentStore) {
  queuedPersistStore = store;
  markPendingPersist();

  if (!persistQueue) {
    let completed = false;

    persistQueue = flushPersistQueue()
      .then((result) => {
        completed = true;
        return result;
      })
      .catch(() => null)
      .finally(() => {
        persistQueue = null;

        if (completed && queuedPersistStore) {
          void queuePersist(queuedPersistStore);
        }
      });
  }

  return persistQueue;
}

export function readGuideContent(): GuideContentStore {
  if (!canUseStorage()) {
    return cloneDefaultStore();
  }

  try {
    const raw = window.localStorage.getItem(GUIDE_CONTENT_KEY);

    if (raw) {
      return normalizeStore(JSON.parse(raw) as Partial<GuideContentStore>);
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_GUIDE_CONTENT_KEY);
    if (legacyRaw) {
      const migrated = migrateLegacyStore(legacyRaw);
      if (migrated) {
        writeGuideContent(migrated, { persist: false, emit: true });
        return migrated;
      }
    }

    return cloneDefaultStore();
  } catch {
    return cloneDefaultStore();
  }
}

export function writeGuideContent(
  store: GuideContentStore,
  options: {
    persist?: boolean;
    emit?: boolean;
    source?: 'local' | 'remote';
  } = {}
) {
  const nextStore = normalizeStore(store);
  const source = options.source ?? 'local';

  if (canUseStorage()) {
    window.localStorage.setItem(GUIDE_CONTENT_KEY, JSON.stringify(nextStore));
  }

  if (source === 'local') {
    markLocalWrite();
  }

  if (options.emit !== false) {
    emitGuideContentUpdate();
  }

  if (options.persist) {
    void queuePersist(nextStore);
  }

  return nextStore;
}

export function updateGuideContent(
  updater: (current: GuideContentStore) => GuideContentStore,
  options: {
    persist?: boolean;
  } = {}
) {
  const current = readGuideContent();
  return writeGuideContent(updater(current), {
    persist: options.persist ?? true,
    emit: true
  });
}

export async function syncGuideContentFromServer(scope: GuideContentScope = 'public') {
  if (typeof window === 'undefined') {
    return cloneDefaultStore();
  }

  if (scope === 'owner' && hasPendingPersist()) {
    const localStore = readGuideContent();
    void queuePersist(localStore);
    return localStore;
  }

  if (!serverSyncPromises[scope]) {
    const syncStartedAt = Date.now();
    const syncStartedVersion = lastLocalWriteVersion;
    serverSyncPromises[scope] = fetchContentFromServer(scope)
      .then((remoteStore) => {
        if (scope === 'public') {
          const localStore = readGuideContent();
          const mergedStore = mergePublicClientState(remoteStore, localStore);
          return writeGuideContent(mergedStore, { persist: false, emit: true, source: 'remote' });
        }

        if (hasPendingPersist() || lastLocalWriteVersion > syncStartedVersion || lastLocalWriteAt > syncStartedAt) {
          return readGuideContent();
        }

        return writeGuideContent(remoteStore, { persist: false, emit: true, source: 'remote' });
      })
      .catch(() => readGuideContent())
      .finally(() => {
        delete serverSyncPromises[scope];
      }) as Promise<GuideContentStore>;
  }

  return serverSyncPromises[scope] as Promise<GuideContentStore>;
}

export async function resetGuideContent() {
  clearPendingPersist();
  const localReset = writeGuideContent(cloneDefaultStore(), { persist: false, emit: true });

  try {
    const response = await fetch(buildApiUrl(GUIDE_CONTENT_RESET_ENDPOINT), {
      method: 'POST',
      credentials: 'include'
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; content?: GuideContentStore };

    if (response.ok && payload.content) {
      return writeGuideContent(payload.content, { persist: false, emit: true });
    }
  } catch {
    // ignore network errors and keep local reset state
  }

  return localReset;
}

export type { GuideContentStore } from '../types';
