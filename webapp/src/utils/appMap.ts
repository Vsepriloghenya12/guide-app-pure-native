import type { GuidePlace, Listing } from '../types';

export type AppMapPoint = {
  lat: number;
  lng: number;
};

export const DANANG_MAP_CENTER: AppMapPoint = {
  lat: 16.0544,
  lng: 108.2022
};

export function hasAppMapCoordinates(place: Partial<Pick<Listing | GuidePlace, 'lat' | 'lng'>>): place is { lat: number; lng: number } {
  return typeof place.lat === 'number' && Number.isFinite(place.lat) && typeof place.lng === 'number' && Number.isFinite(place.lng);
}
