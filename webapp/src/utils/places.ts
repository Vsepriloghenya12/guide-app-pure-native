import type { Listing } from '../types';

type MapTarget = Pick<Listing, 'mapQuery' | 'address' | 'title'> & Partial<Pick<Listing, 'lat' | 'lng'>>;

function hasPlaceCoordinates(place: Partial<Pick<Listing, 'lat' | 'lng'>>) {
  return typeof place.lat === 'number' && Number.isFinite(place.lat) && typeof place.lng === 'number' && Number.isFinite(place.lng);
}

function getCoordinateQuery(place: Partial<Pick<Listing, 'lat' | 'lng'>>) {
  return hasPlaceCoordinates(place) ? `${place.lat},${place.lng}` : '';
}

function getRawPlaceMapValue(place: MapTarget) {
  return String(place.mapQuery || getCoordinateQuery(place) || place.address || place.title || '').trim();
}

function looksLikeExternalMapUrl(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return false;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : trimmed.startsWith('www.') ? `https://${trimmed}` : '';
  if (!candidate) {
    return false;
  }

  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    return hostname.includes('maps') || hostname === 'goo.gl' || hostname.includes('openstreetmap') || hostname.includes('2gis');
  } catch {
    return false;
  }
}

export function getPlaceMapQuery(place: MapTarget) {
  const rawValue = getRawPlaceMapValue(place);
  if (looksLikeExternalMapUrl(rawValue)) {
    return getCoordinateQuery(place) || place.address || place.title;
  }

  return rawValue;
}

export function createOpenStreetMapUrl(place: MapTarget) {
  if (hasPlaceCoordinates(place)) {
    return `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=16/${place.lat}/${place.lng}`;
  }

  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(getPlaceMapQuery(place))}`;
}

export function createAppleMapsUrl(place: MapTarget) {
  return `https://maps.apple.com/?q=${encodeURIComponent(getPlaceMapQuery(place))}`;
}

export function create2GisUrl(place: MapTarget) {
  return `https://2gis.com/?query=${encodeURIComponent(getPlaceMapQuery(place))}`;
}

export function createOpenStreetMapDirectionsUrl(
  place: MapTarget,
  origin?: { lat: number; lng: number } | null
) {
  if (!hasPlaceCoordinates(place)) {
    return createOpenStreetMapUrl(place);
  }

  if (!origin) {
    return createOpenStreetMapUrl(place);
  }

  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin.lat}%2C${origin.lng}%3B${place.lat}%2C${place.lng}`;
}

export function createAppleDirectionsUrl(
  place: MapTarget,
  origin?: { lat: number; lng: number } | null
) {
  const destination = encodeURIComponent(getPlaceMapQuery(place));
  if (!origin) {
    return `https://maps.apple.com/?daddr=${destination}&dirflg=d`;
  }

  return `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${destination}&dirflg=d`;
}

export function create2GisDirectionsUrl(
  place: MapTarget,
  origin?: { lat: number; lng: number } | null
) {
  const destination = encodeURIComponent(getPlaceMapQuery(place));
  if (!origin) {
    return `https://2gis.com/routeSearch/rsType/car/to/${destination}`;
  }

  return `https://2gis.com/routeSearch/rsType/car/from/${origin.lng},${origin.lat}/to/${destination}`;
}

export function formatDistance(distanceKm: number | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return 'Без расстояния';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} м`;
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} км`;
}

export function formatOpeningHours(hours: string | null | undefined) {
  const source = String(hours || '').trim();
  if (!source) {
    return '';
  }

  const cleaned = source
    .replace(/^(режим работы|работы)(?=$|[\s:,.-])[\s:,.-]*/iu, '')
    .replace(/^(ежедневно|каждый день|пн\s*[-–—]\s*вс|пн\s*-\s*вс)(?=$|[\s:,.-])[\s:,.-]*/iu, '')
    .trim();
  return cleaned || source;
}

export function estimateTravelTime(distanceKm: number | null, mode: 'walk' | 'drive' = 'drive') {
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return '';
  }

  const speed = mode === 'walk' ? 4.5 : 28;
  const totalMinutes = Math.max(1, Math.round((distanceKm / speed) * 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} мин`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

export function haversineDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function hasCoordinates(place: Partial<Listing>) {
  return typeof place.lat === 'number' && Number.isFinite(place.lat) && typeof place.lng === 'number' && Number.isFinite(place.lng);
}

export function comparePlacesByPriority(left: Partial<Listing>, right: Partial<Listing>) {
  const leftOrder = Number(left.sortOrder ?? 1000);
  const rightOrder = Number(right.sortOrder ?? 1000);
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  if (left.top !== right.top) {
    return Number(right.top) - Number(left.top);
  }
  const leftTop = Boolean(left.top ?? left.featured);
  const rightTop = Boolean(right.top ?? right.featured);
  if (leftTop !== rightTop) {
    return Number(rightTop) - Number(leftTop);
  }

  return String(left.title || '').localeCompare(String(right.title || ''));
}

export function sortPlacesByPriority<T extends Partial<Listing>>(places: T[]) {
  return [...places].sort(comparePlacesByPriority);
}
export function toListingLike(place: Listing): Listing;
export function toListingLike(place: Partial<Listing> & { id: string; title: string; categoryId: Listing['categoryId']; description: string; address: string; }): Listing;
export function toListingLike(place: Partial<Listing> & { id: string; title: string; categoryId: Listing['categoryId']; description: string; address: string; }): Listing {
  const { rating: _legacyRating, ...normalizedPlace } = place as Partial<Listing> & { rating?: number };
  const slug = place.slug || `${place.categorySlug || place.categoryId}-${place.id}`;
  const imageUrls = Array.isArray(place.imageUrls) ? place.imageUrls.filter(Boolean) : Array.isArray(place.imageGallery) ? place.imageGallery.filter(Boolean) : place.imageSrc ? [place.imageSrc] : [];
  const coordinateQuery = getCoordinateQuery(place);
  const normalizedHours = formatOpeningHours(place.hours || '');
  return {
    ...normalizedPlace,
    slug,
    categorySlug: place.categorySlug || place.categoryId,
    imageUrls,
    coverImageUrl: place.coverImageUrl || imageUrls[0] || place.imageSrc || '',
    websiteUrl: place.websiteUrl || place.website || '',
    phoneNumber: place.phoneNumber || place.phone || '',
    hotelStars: typeof place.hotelStars === 'number' ? place.hotelStars : null,
    hotelPool: Boolean(place.hotelPool),
    hotelSpa: Boolean(place.hotelSpa),
    district: place.district || '',
    location: place.location || place.address || '',
    type: place.type || place.kind || '',
    featured: Boolean(place.featured ?? place.top),
    shortDescription: place.shortDescription || place.description,
    hours: normalizedHours,
    priceLabel: place.priceLabel || (typeof place.avgCheck === 'number' ? `от ${place.avgCheck}` : ''),
    listingType: place.listingType || place.kind || '',
    childFriendly: Boolean(place.childFriendly ?? place.childPrograms),
    petFriendly: Boolean(place.petFriendly ?? place.pets),
    mapQuery: place.mapQuery || coordinateQuery || place.address || place.title,
    extra: Array.isArray(place.extra) ? place.extra : Array.isArray(place.services) ? place.services : []
  } as Listing;
}
