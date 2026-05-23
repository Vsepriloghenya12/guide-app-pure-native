import type { GuidePlace, Listing } from '../types';

export type AppMapBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type AppMapPoint = {
  lat: number;
  lng: number;
};

export const DANANG_APP_MAP_BOUNDS: AppMapBounds = {
  minLat: 15.93,
  maxLat: 16.19,
  minLng: 108.05,
  maxLng: 108.33
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function hasAppMapCoordinates(place: Partial<Pick<Listing | GuidePlace, 'lat' | 'lng'>>): place is { lat: number; lng: number } {
  return typeof place.lat === 'number' && Number.isFinite(place.lat) && typeof place.lng === 'number' && Number.isFinite(place.lng);
}

export function isPointInsideAppMap(point: AppMapPoint, bounds: AppMapBounds = DANANG_APP_MAP_BOUNDS) {
  return point.lat >= bounds.minLat && point.lat <= bounds.maxLat && point.lng >= bounds.minLng && point.lng <= bounds.maxLng;
}

export function projectLatLngToAppMap(point: AppMapPoint, bounds: AppMapBounds = DANANG_APP_MAP_BOUNDS) {
  const rawX = ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
  const rawY = (1 - (point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;

  return {
    x: clamp(rawX, 4, 96),
    y: clamp(rawY, 5, 95),
    isInside: isPointInsideAppMap(point, bounds)
  };
}

export function formatAppMapCoordinates(point: AppMapPoint) {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

function normalizeCoordinate(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLatLngPair(latValue: string, lngValue: string) {
  const lat = normalizeCoordinate(latValue);
  const lng = normalizeCoordinate(lngValue);

  if (lat === null || lng === null) {
    return null;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { lat, lng };
}

export function extractLatLngFromMapsInput(value: string): AppMapPoint | null {
  const input = String(value || '').trim();
  if (!input) {
    return null;
  }

  const atMatch = input.match(/@(-?\d+(?:[.,]\d+)?),\s*(-?\d+(?:[.,]\d+)?)/);
  if (atMatch) {
    const parsed = parseLatLngPair(atMatch[1], atMatch[2]);
    if (parsed) return parsed;
  }

  const googlePlaceMatch = input.match(/!3d(-?\d+(?:[.,]\d+)?)!4d(-?\d+(?:[.,]\d+)?)/);
  if (googlePlaceMatch) {
    const parsed = parseLatLngPair(googlePlaceMatch[1], googlePlaceMatch[2]);
    if (parsed) return parsed;
  }

  const queryMatch = input.match(/[?&](?:q|query|ll|center|destination)=(-?\d+(?:[.,]\d+)?),\s*(-?\d+(?:[.,]\d+)?)/i);
  if (queryMatch) {
    const parsed = parseLatLngPair(queryMatch[1], queryMatch[2]);
    if (parsed) return parsed;
  }

  const plainPairMatch = input.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)\s*$/);
  if (plainPairMatch) {
    const parsed = parseLatLngPair(plainPairMatch[1], plainPairMatch[2]);
    if (parsed) return parsed;
  }

  return null;
}


export const DANANG_MAP_CENTER: AppMapPoint = {
  lat: 16.0544,
  lng: 108.2022
};

export const DANANG_PUBLIC_MAP_ZOOM = 12;
export const DANANG_OWNER_MAP_ZOOM = 13;
export const OSM_TILE_SIZE = 256;

export type AppMapSize = {
  width: number;
  height: number;
};

export type AppMapPixelPoint = {
  x: number;
  y: number;
};

export type OsmTile = {
  key: string;
  url: string;
  left: number;
  top: number;
  size: number;
};

export function latLngToWorldPixel(point: AppMapPoint, zoom: number) {
  const scale = OSM_TILE_SIZE * 2 ** zoom;
  const sinLat = Math.sin((clamp(point.lat, -85.05112878, 85.05112878) * Math.PI) / 180);

  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  };
}

export function worldPixelToLatLng(pixel: AppMapPixelPoint, zoom: number): AppMapPoint {
  const scale = OSM_TILE_SIZE * 2 ** zoom;
  const lng = (pixel.x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * pixel.y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

export function projectLatLngToTileMap(
  point: AppMapPoint,
  center: AppMapPoint = DANANG_MAP_CENTER,
  zoom: number = DANANG_PUBLIC_MAP_ZOOM,
  size: AppMapSize
) {
  const centerPixel = latLngToWorldPixel(center, zoom);
  const pointPixel = latLngToWorldPixel(point, zoom);

  return {
    x: size.width / 2 + (pointPixel.x - centerPixel.x),
    y: size.height / 2 + (pointPixel.y - centerPixel.y)
  };
}

export function projectTileMapPointToLatLng(
  point: AppMapPixelPoint,
  center: AppMapPoint = DANANG_MAP_CENTER,
  zoom: number = DANANG_OWNER_MAP_ZOOM,
  size: AppMapSize
) {
  const centerPixel = latLngToWorldPixel(center, zoom);
  return worldPixelToLatLng(
    {
      x: centerPixel.x + point.x - size.width / 2,
      y: centerPixel.y + point.y - size.height / 2
    },
    zoom
  );
}

export function getOsmTileUrl(x: number, y: number, zoom: number) {
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

export function getOsmTiles(
  center: AppMapPoint = DANANG_MAP_CENTER,
  zoom: number = DANANG_PUBLIC_MAP_ZOOM,
  size: AppMapSize
): OsmTile[] {
  if (!size.width || !size.height) {
    return [];
  }

  const centerPixel = latLngToWorldPixel(center, zoom);
  const worldSize = OSM_TILE_SIZE * 2 ** zoom;
  const minX = centerPixel.x - size.width / 2;
  const minY = centerPixel.y - size.height / 2;
  const maxX = centerPixel.x + size.width / 2;
  const maxY = centerPixel.y + size.height / 2;
  const minTileX = Math.floor(minX / OSM_TILE_SIZE) - 1;
  const maxTileX = Math.floor(maxX / OSM_TILE_SIZE) + 1;
  const minTileY = Math.floor(minY / OSM_TILE_SIZE) - 1;
  const maxTileY = Math.floor(maxY / OSM_TILE_SIZE) + 1;
  const tileCount = 2 ** zoom;
  const tiles: OsmTile[] = [];

  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      if (tileY < 0 || tileY >= tileCount) {
        continue;
      }

      const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${wrappedTileX}-${tileY}`,
        url: getOsmTileUrl(wrappedTileX, tileY, zoom),
        left: tileX * OSM_TILE_SIZE - minX,
        top: tileY * OSM_TILE_SIZE - minY,
        size: OSM_TILE_SIZE
      });
    }
  }

  return tiles;
}
