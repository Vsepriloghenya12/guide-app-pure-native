import { Linking } from 'react-native';
import type { GuidePlace } from '../types';

function getMapQuery(place: GuidePlace) {
  if (typeof place.lat === 'number' && Number.isFinite(place.lat) && typeof place.lng === 'number' && Number.isFinite(place.lng)) {
    return `${place.lat},${place.lng}`;
  }
  return String(place.mapQuery || place.address || place.title).trim();
}

function getOpenStreetMapPointUrl(place: GuidePlace) {
  if (typeof place.lat === 'number' && Number.isFinite(place.lat) && typeof place.lng === 'number' && Number.isFinite(place.lng)) {
    return `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=16/${place.lat}/${place.lng}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(getMapQuery(place))}`;
}

export function directionsUrl(place: GuidePlace) {
  return getOpenStreetMapPointUrl(place);
}

export async function openExternalUrl(url: string) {
  const safeUrl = String(url || '').trim();
  if (!safeUrl) return;
  const supported = await Linking.canOpenURL(safeUrl);
  if (supported || /^https?:\/\//i.test(safeUrl)) {
    await Linking.openURL(safeUrl);
  }
}
