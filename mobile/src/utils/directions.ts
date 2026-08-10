export type LatLng = { latitude: number; longitude: number };

export type TravelMode = 'walk' | 'scooter' | 'bike' | 'taxi';

export type RouteStep = {
  text: string;
  distanceMeters: number | null;
  maneuver: 'straight' | 'left' | 'right' | 'finish' | 'other';
};

export type WalkingRoute = {
  coordinates: LatLng[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  /** true when the geometry follows roads (came from a routing API), false for a straight-line fallback */
  roadRoute: boolean;
  mode: TravelMode;
  steps: RouteStep[];
};

// Comes from the EXPO_PUBLIC_GOOGLE_MAPS_API_KEY EAS environment variable at
// bundle time — no hardcoded fallback, keys don't belong in source control.
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
if (!GOOGLE_MAPS_API_KEY) {
  // Loud, once, in every build type: without the key every route silently
  // degrades to a straight line — that must never be a mystery again
  // eslint-disable-next-line no-console
  console.warn('[routes] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set — road routing is disabled, only straight lines will be shown');
}
const REQUEST_TIMEOUT_MS = 15000;

const ROUTES_API_MODE: Record<TravelMode, string> = {
  walk: 'WALK',
  scooter: 'TWO_WHEELER',
  bike: 'BICYCLE',
  taxi: 'DRIVE'
};

const LEGACY_API_MODE: Record<TravelMode, string> = {
  walk: 'walking',
  scooter: 'driving',
  bike: 'bicycling',
  taxi: 'driving'
};

// Straight-line fallback speeds, km/h
const FALLBACK_SPEED_KMH: Record<TravelMode, number> = {
  walk: 4.5,
  scooter: 22,
  bike: 12,
  taxi: 24
};

/** Decodes a Google encoded polyline into a list of coordinates. */
export function decodePolyline(encoded: string): LatLng[] {
  const coordinates: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    const latitude = lat / 1e5;
    const longitude = lng / 1e5;
    // Guard against malformed input producing out-of-range/NaN pairs that would crash the native map
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      coordinates.push({ latitude, longitude });
    }
  }

  return coordinates;
}

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Fetch with one retry on transient failure (network drop, 429, 5xx).
 * Without this, a single flaky request on a slow mobile network collapses the whole
 * route to a straight line — the main reason some users only ever see «(по прямой)».
 * Timeouts are NOT retried: the abort already burned 15s, and stacking another
 * attempt would push a bike cache-miss past a minute of spinner.
 */
async function fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init);
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        continue; // transient server/rate error — brief backoff, then one more try
      }
      return response;
    } catch (error) {
      lastError = error;
      const isTimeoutAbort = error instanceof Error && error.name === 'AbortError';
      if (isTimeoutAbort || attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  throw lastError;
}

function parseRoutesApiDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const seconds = Number(value.replace(/s$/i, ''));
  return Number.isFinite(seconds) ? seconds : null;
}

function toStepManeuver(raw: unknown): RouteStep['maneuver'] {
  const value = typeof raw === 'string' ? raw : '';
  if (/LEFT/.test(value)) return 'left';
  if (/RIGHT/.test(value)) return 'right';
  if (/STRAIGHT|CONTINUE|DEPART|NAME_CHANGE|MERGE/.test(value)) return 'straight';
  if (/ARRIVE|DESTINATION/.test(value)) return 'finish';
  return 'other';
}

function parseRoutesApiSteps(route: any): RouteStep[] {
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  const steps: RouteStep[] = [];
  for (const leg of legs) {
    const legSteps = Array.isArray(leg?.steps) ? leg.steps : [];
    for (const step of legSteps) {
      const text = typeof step?.navigationInstruction?.instructions === 'string'
        ? step.navigationInstruction.instructions.trim()
        : '';
      if (!text) continue;
      steps.push({
        text,
        distanceMeters: Number.isFinite(step?.distanceMeters) ? step.distanceMeters : null,
        maneuver: toStepManeuver(step?.navigationInstruction?.maneuver)
      });
    }
  }
  return steps;
}

/** Google Routes API (the current routing product). Needs "Routes API" enabled for the key's project. */
async function fetchViaRoutesApi(origin: LatLng, destination: LatLng, waypoints: LatLng[], mode: TravelMode, apiMode?: string): Promise<WalkingRoute | null> {
  const toWaypoint = (point: LatLng) => ({ location: { latLng: { latitude: point.latitude, longitude: point.longitude } } });
  const response = await fetchWithRetry('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration,routes.legs.steps.navigationInstruction.instructions,routes.legs.steps.navigationInstruction.maneuver,routes.legs.steps.distanceMeters'
    },
    body: JSON.stringify({
      origin: toWaypoint(origin),
      destination: toWaypoint(destination),
      ...(waypoints.length > 0 ? { intermediates: waypoints.map(toWaypoint) } : {}),
      travelMode: apiMode || ROUTES_API_MODE[mode],
      languageCode: 'ru',
      units: 'METRIC'
    })
  });
  const currentApiMode = apiMode || ROUTES_API_MODE[mode];
  // TWO_WHEELER and BICYCLE aren't available in every region (e.g. Google has no
  // bicycling data for Vietnam — the API returns 200 with an empty routes array).
  // In those places bikes/scooters ride the roads, so DRIVE is the right road route.
  const canFallBackToDrive = currentApiMode === 'TWO_WHEELER' || currentApiMode === 'BICYCLE';

  if (!response.ok) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // Helps tell a real denial (403 REQUEST_DENIED / key restriction) from a network drop
      const body = await response.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.warn(`[routes] ${currentApiMode} HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    if (canFallBackToDrive) {
      return fetchViaRoutesApi(origin, destination, waypoints, mode, 'DRIVE');
    }
    return null;
  }

  const payload = await response.json();
  const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;
  const encoded = route?.polyline?.encodedPolyline;
  if (typeof encoded !== 'string' || !encoded) {
    // 200 but no usable route (unsupported mode/region) → try DRIVE before giving up
    if (canFallBackToDrive) {
      return fetchViaRoutesApi(origin, destination, waypoints, mode, 'DRIVE');
    }
    return null;
  }

  const coordinates = decodePolyline(encoded);
  if (coordinates.length < 2) return null;

  return {
    coordinates,
    distanceMeters: Number.isFinite(route?.distanceMeters) ? route.distanceMeters : null,
    durationSeconds: parseRoutesApiDuration(route?.duration),
    roadRoute: true,
    mode,
    steps: parseRoutesApiSteps(route)
  };
}

/** Legacy Directions API fallback for projects that have it enabled instead of the Routes API. */
async function fetchViaLegacyDirections(origin: LatLng, destination: LatLng, waypoints: LatLng[], mode: TravelMode): Promise<WalkingRoute | null> {
  const point = (value: LatLng) => `${value.latitude},${value.longitude}`;
  const params = new URLSearchParams({
    origin: point(origin),
    destination: point(destination),
    mode: LEGACY_API_MODE[mode],
    language: 'ru',
    key: GOOGLE_MAPS_API_KEY
  });
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(point).join('|'));
  }

  const response = await fetchWithTimeout(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`, { method: 'GET' });
  if (!response.ok) return null;

  const payload = await response.json();
  if (payload?.status !== 'OK') return null;
  const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;
  const encoded = route?.overview_polyline?.points;
  if (typeof encoded !== 'string' || !encoded) return null;

  const coordinates = decodePolyline(encoded);
  if (coordinates.length < 2) return null;

  const legs = Array.isArray(route?.legs) ? route.legs : [];
  let distanceMeters = 0;
  let durationSeconds = 0;
  for (const leg of legs) {
    if (Number.isFinite(leg?.distance?.value)) distanceMeters += leg.distance.value;
    if (Number.isFinite(leg?.duration?.value)) durationSeconds += leg.duration.value;
  }

  return {
    coordinates,
    distanceMeters: distanceMeters > 0 ? distanceMeters : null,
    durationSeconds: durationSeconds > 0 ? durationSeconds : null,
    roadRoute: true,
    mode,
    steps: []
  };
}

function haversineMeters(from: LatLng, to: LatLng): number {
  const earthRadius = 6371000;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) * Math.cos((to.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

/** Straight-line fallback so the user always sees something on the in-app map. */
function buildStraightLineRoute(origin: LatLng, destination: LatLng, waypoints: LatLng[], mode: TravelMode): WalkingRoute {
  const coordinates = [origin, ...waypoints, destination];
  let distanceMeters = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    distanceMeters += haversineMeters(coordinates[i - 1], coordinates[i]);
  }
  const durationSeconds = Math.round((distanceMeters / (FALLBACK_SPEED_KMH[mode] * 1000)) * 3600);
  return { coordinates, distanceMeters, durationSeconds, roadRoute: false, mode, steps: [] };
}

/**
 * Builds a route for the in-app map: Routes API first, legacy Directions API second,
 * straight line as the last resort. Never throws.
 */
export async function fetchRoute(origin: LatLng, destination: LatLng, waypoints: LatLng[] = [], mode: TravelMode = 'walk'): Promise<WalkingRoute> {
  try {
    const viaRoutes = await fetchViaRoutesApi(origin, destination, waypoints, mode);
    if (viaRoutes) return viaRoutes;
  } catch {
    // fall through to the next provider
  }
  try {
    const viaLegacy = await fetchViaLegacyDirections(origin, destination, waypoints, mode);
    if (viaLegacy) return viaLegacy;
  } catch {
    // fall through to the straight line
  }
  return buildStraightLineRoute(origin, destination, waypoints, mode);
}

/** Backwards-compatible walking wrapper (used by the city-routes screen). */
export function fetchWalkingRoute(origin: LatLng, destination: LatLng, waypoints: LatLng[] = []): Promise<WalkingRoute> {
  return fetchRoute(origin, destination, waypoints, 'walk');
}

export function formatDistanceMeters(distanceMeters: number | null): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters === null) return '';
  return distanceMeters < 1000 ? `${Math.round(distanceMeters)} м` : `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} км`;
}

export function formatDurationShort(durationSeconds: number | null): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds === null) return '';
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

/** "1,8 км · ~23 мин" — the compact summary used on the CTA pill and the route sheet. */
export function formatRouteShort(route: WalkingRoute): string {
  const distance = formatDistanceMeters(route.distanceMeters);
  const duration = formatDurationShort(route.durationSeconds);
  const parts = [distance, duration ? `~${duration}` : ''].filter(Boolean);
  const summary = parts.join(' · ');
  return route.roadRoute ? summary : `${summary} (по прямой)`;
}

const MODE_WORD: Record<TravelMode, string> = {
  walk: 'пешком',
  scooter: 'на скутере',
  bike: 'на велосипеде',
  taxi: 'на такси'
};

export function travelModeWord(mode: TravelMode): string {
  return MODE_WORD[mode];
}

export function formatRouteSummary(route: WalkingRoute): string {
  const distance = formatDistanceMeters(route.distanceMeters);
  const duration = formatDurationShort(route.durationSeconds);
  const parts = [distance, duration ? `~${duration} ${MODE_WORD[route.mode]}` : ''].filter(Boolean);
  const summary = parts.join(' · ');
  return route.roadRoute ? summary : `${summary} (по прямой)`;
}
