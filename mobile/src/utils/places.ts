import { API_BASE_URL } from '../api/client';
import { normalizeImageUrl } from './normalizers';
import { toText, toTextArray, normalizeToken, isValidLatitude, isValidLongitude } from './helpers';
import type { GuideCategory, GuideCollection, GuidePlace } from '../types';
import type { NativeRoute } from '../types/app';

export function matchesQuickToken(place: GuidePlace, token: string) {
  const normalized = normalizeToken(token);
  if (!normalized) return true;
  if (normalized === 'breakfast') return Boolean(place.breakfast);
  if (normalized === 'vegan') return Boolean(place.vegan);
  if (normalized === 'pets') return Boolean(place.petFriendly ?? place.pets);
  if (normalized === 'childprograms') return Boolean(place.childPrograms ?? place.childFriendly);
  const haystack = [
    place.title,
    place.description,
    place.shortDescription,
    place.address,
    place.kind,
    place.cuisine,
    place.district,
    place.hours,
    place.priceLabel,
    ...toTextArray((place as GuidePlace & { services?: unknown }).services),
    ...toTextArray((place as GuidePlace & { tags?: unknown }).tags)
  ]
    .filter(Boolean)
    .map((value) => normalizeToken(String(value)));
  return haystack.some((value) => value.includes(normalized));
}

export function getPlaceImageUrls(place: GuidePlace) {
  const record = place as GuidePlace & { imageGallery?: unknown; imageUrls?: unknown; coverImageUrl?: unknown; imageSrc?: unknown };
  return [
    toText(record.coverImageUrl),
    toText(record.imageSrc),
    ...toTextArray(record.imageGallery),
    ...toTextArray(record.imageUrls)
  ]
    .map((item) => normalizeImageUrl(item, API_BASE_URL))
    .filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index);
}

export function getPrimaryImageUrl(place: GuidePlace) {
  return getPlaceImageUrls(place)[0] || '';
}

export function placeCoordinate(place: GuidePlace) {
  let lat = typeof place.lat === 'number' ? place.lat : Number(place.lat);
  let lng = typeof place.lng === 'number' ? place.lng : Number(place.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Иногда координаты из CMS вводят наоборот: lng в поле lat, lat в поле lng.
  if (!isValidLatitude(lat) && isValidLatitude(lng) && isValidLongitude(lat)) {
    const previousLat = lat;
    lat = lng;
    lng = previousLat;
  }
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) return null;
  return { latitude: lat, longitude: lng };
}

export function buildMapRegion(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length === 0) {
    return { latitude: 16.0678, longitude: 108.2208, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.012, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.012, (maxLng - minLng) * 1.4)
  };
}

// Best-effort «открыто сейчас» из строки часов. null = не смогли распарсить.
export function isOpenNow(hoursRaw: unknown): boolean | null {
  const text = toText(hoursRaw);
  if (!text) return null;
  if (/круглосуточ|24\s*\/\s*7|24\s*час/i.test(text)) return true;
  const match = text.match(/(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  // Часы мест — данангские (UTC+7); телефон туриста может жить в любом поясе
  const now = new Date();
  const current = (now.getUTCHours() * 60 + now.getUTCMinutes() + 7 * 60) % (24 * 60);
  if (end === start) return true;
  if (end > start) return current >= start && current < end;
  return current >= start || current < end;
}

export function bannerImageSource(collection: GuideCollection) {
  const image = normalizeImageUrl(collection.imageSrc, API_BASE_URL);
  return image ? { uri: image } : null;
}

export function buildRoutesShortcut(): GuideCategory {
  return {
    id: 'routes',
    title: 'Маршруты',
    path: '/routes',
    description: 'Готовые городские маршруты с описанием точек и схемой движения.',
    visible: true,
    showOnHome: true,
    slug: 'routes',
    shortTitle: 'Маршруты',
    accent: 'bridge',
    imageSrc: '',
    filterSchema: {
      quickFilters: [],
      fields: []
    },
    sortOrder: 82
  };
}

export function withRoutesShortcut(categories: GuideCategory[]) {
  if (categories.some((category) => category.id === 'routes')) {
    return categories;
  }
  const shortcut = buildRoutesShortcut();
  const insertAfterId = 'active-rest';
  const insertIndex = categories.findIndex((category) => category.id === insertAfterId);
  if (insertIndex < 0) {
    return [...categories, shortcut];
  }
  return [...categories.slice(0, insertIndex + 1), shortcut, ...categories.slice(insertIndex + 1)];
}

export function googleMapsRouteUrl(route: NativeRoute) {
  const origin = route.points[0];
  const destination = route.points[route.points.length - 1];
  const waypoints = route.points
    .slice(1, -1)
    .map((point) => `${point.lat},${point.lng}`)
    .join('|');
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=walking`;
  return waypoints ? `${base}&waypoints=${encodeURIComponent(waypoints)}` : base;
}