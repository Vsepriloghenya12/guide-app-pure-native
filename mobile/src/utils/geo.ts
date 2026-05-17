import type { GuidePlace } from '../types';

export function hasCoordinates(place: Partial<GuidePlace>): place is GuidePlace & { lat: number; lng: number } {
  return typeof place.lat === 'number' && Number.isFinite(place.lat) && typeof place.lng === 'number' && Number.isFinite(place.lng);
}

export function haversineDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
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

export function formatDistance(distanceKm: number | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return 'Нет расстояния';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} м`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} км`;
}

export function estimateTravelTime(distanceKm: number | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return '';
  const minutes = Math.max(1, Math.round((distanceKm / 28) * 60));
  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч ${minutes % 60 || ''}`.trim();
}
