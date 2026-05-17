import { Linking } from 'react-native';
import type { GuidePlace } from '../types';

function getMapQuery(place: GuidePlace) {
  if (typeof place.lat === 'number' && Number.isFinite(place.lat) && typeof place.lng === 'number' && Number.isFinite(place.lng)) {
    return `${place.lat},${place.lng}`;
  }
  return String(place.mapQuery || place.address || place.title).trim();
}

export function googleMapsUrl(place: GuidePlace) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getMapQuery(place))}`;
}

export function appleMapsUrl(place: GuidePlace) {
  return `https://maps.apple.com/?q=${encodeURIComponent(getMapQuery(place))}`;
}

export function directionsUrl(place: GuidePlace) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(getMapQuery(place))}`;
}

export async function openExternalUrl(url: string) {
  const safeUrl = String(url || '').trim();
  if (!safeUrl) return;
  const supported = await Linking.canOpenURL(safeUrl);
  if (supported || /^https?:\/\//i.test(safeUrl)) {
    await Linking.openURL(safeUrl);
  }
}
