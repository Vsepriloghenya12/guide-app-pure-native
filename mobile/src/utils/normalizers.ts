import type { BootstrapPayload, GuideCategory, GuideContentStore, GuidePlace, SupportContentStore } from '../types';
import { defaultGuideContent } from '../data/defaultContent';
import { defaultSupportContent } from '../data/defaultSupportContent';

function cleanString(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function cleanArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => cleanString(item)).filter(Boolean) : [];
}

export function normalizeImageUrl(value: unknown, apiBaseUrl: string) {
  const raw = cleanString(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!apiBaseUrl) return raw;
  return `${apiBaseUrl.replace(/\/+$/g, '')}/${raw.replace(/^\/+/, '')}`;
}

export function normalizeCategory(category: Partial<GuideCategory>, index = 0): GuideCategory {
  const id = cleanString(category.id || category.slug, `category-${index + 1}`);
  const title = cleanString(category.title || category.shortTitle, id);
  const slug = cleanString(category.slug || id, id);

  return {
    id,
    title,
    slug,
    path: category.path || `/section/${slug}`,
    badge: cleanString(category.badge),
    description: cleanString(category.description),
    visible: category.visible !== false,
    showOnHome: Boolean(category.showOnHome),
    shortTitle: cleanString(category.shortTitle, title),
    accent: cleanString(category.accent, 'coast'),
    imageSrc: cleanString(category.imageSrc),
    sortOrder: Number.isFinite(Number(category.sortOrder)) ? Number(category.sortOrder) : index + 100,
    filterSchema: {
      quickFilters: cleanArray(category.filterSchema?.quickFilters),
      fields: cleanArray(category.filterSchema?.fields)
    }
  };
}

export function normalizePlace(place: Partial<GuidePlace>, index = 0): GuidePlace {
  const id = cleanString(place.id || place.slug, `place-${index + 1}`);
  const title = cleanString(place.title, 'Без названия');
  const categoryId = cleanString(place.categoryId || place.categorySlug, 'restaurants');
  const slug = cleanString(place.slug || `${categoryId}-${id}`, `${categoryId}-${id}`);
  const imageGallery = Array.isArray(place.imageGallery) ? place.imageGallery.filter(Boolean) : [];
  const imageUrls = Array.isArray(place.imageUrls) ? place.imageUrls.filter(Boolean) : [];
  const coverImageUrl = cleanString(place.coverImageUrl || imageUrls[0] || place.imageSrc || imageGallery[0]);

  return {
    ...place,
    id,
    title,
    categoryId,
    slug,
    categorySlug: cleanString(place.categorySlug || categoryId, categoryId),
    description: cleanString(place.description),
    shortDescription: cleanString(place.shortDescription || place.description),
    address: cleanString(place.address || place.location),
    phone: cleanString(place.phone || place.phoneNumber),
    phoneNumber: cleanString(place.phoneNumber || place.phone),
    website: cleanString(place.website || place.websiteUrl),
    websiteUrl: cleanString(place.websiteUrl || place.website),
    hours: cleanString(place.hours),
    kind: cleanString(place.kind || place.type || place.listingType),
    cuisine: cleanString(place.cuisine),
    services: cleanArray(place.services),
    tags: cleanArray(place.tags),
    extra: cleanArray(place.extra),
    imageGallery,
    imageUrls: imageUrls.length ? imageUrls : imageGallery,
    imageSrc: cleanString(place.imageSrc || coverImageUrl),
    coverImageUrl,
    district: cleanString(place.district),
    location: cleanString(place.location || place.address),
    listingType: cleanString(place.listingType || place.kind || place.type),
    type: cleanString(place.type || place.kind || place.listingType),
    priceLabel: cleanString(place.priceLabel),
    mapQuery: cleanString(place.mapQuery || place.address || title),
    status: place.status || 'published',
    visible: place.visible !== false,
    featured: Boolean(place.featured || place.top),
    top: Boolean(place.top || place.featured),
    childFriendly: Boolean(place.childFriendly || place.childPrograms),
    petFriendly: Boolean(place.petFriendly || place.pets),
    breakfast: Boolean(place.breakfast),
    vegan: Boolean(place.vegan),
    pets: Boolean(place.pets),
    childPrograms: Boolean(place.childPrograms),
    sortOrder: Number.isFinite(Number(place.sortOrder)) ? Number(place.sortOrder) : index + 100,
    lat: typeof place.lat === 'number' && Number.isFinite(place.lat) ? place.lat : null,
    lng: typeof place.lng === 'number' && Number.isFinite(place.lng) ? place.lng : null
  };
}

export function normalizeBootstrap(payload?: Partial<BootstrapPayload> | null): BootstrapPayload {
  const sourceContent = payload?.content || defaultGuideContent;
  const categories = (payload?.categories || sourceContent.categories || []).map(normalizeCategory).filter((category) => category.visible);
  const visibleCategoryIds = new Set(categories.map((category) => category.id));
  const listings = (payload?.listings || sourceContent.places || [])
    .map(normalizePlace)
    .filter((place) => place.visible !== false && place.status !== 'hidden' && place.status !== 'draft' && visibleCategoryIds.has(place.categoryId))
    .sort((left, right) => (left.sortOrder ?? 1000) - (right.sortOrder ?? 1000) || left.title.localeCompare(right.title, 'ru'));
  const collections = (payload?.collections || sourceContent.collections || []).filter((item) => item.active !== false);
  const tips = (payload?.tips || sourceContent.tips || []).filter((item) => item.active !== false);

  return {
    categories,
    listings,
    collections,
    tips,
    home: payload?.home || sourceContent.home
  };
}

export function normalizeSupportContent(content?: Partial<SupportContentStore> | null): SupportContentStore {
  return {
    ...defaultSupportContent,
    ...content,
    contactChannels: Array.isArray(content?.contactChannels) && content.contactChannels.length > 0
      ? content.contactChannels.map((item, index) => ({
          id: cleanString(item.id, `channel-${index + 1}`),
          title: cleanString(item.title, 'Контакт'),
          subtitle: cleanString(item.subtitle),
          value: cleanString(item.value),
          href: cleanString(item.href),
          kind: item.kind || 'telegram'
        }))
      : defaultSupportContent.contactChannels,
    emergencyContacts: Array.isArray(content?.emergencyContacts) && content.emergencyContacts.length > 0
      ? content.emergencyContacts.map((item, index) => ({
          id: cleanString(item.id, `emergency-${index + 1}`),
          title: cleanString(item.title, 'Контакт'),
          description: cleanString(item.description),
          value: cleanString(item.value),
          href: cleanString(item.href)
        }))
      : defaultSupportContent.emergencyContacts
  };
}
