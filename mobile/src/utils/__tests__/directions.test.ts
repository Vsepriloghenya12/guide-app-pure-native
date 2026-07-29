import { describe, expect, it } from 'vitest';
import {
  decodePolyline,
  formatDistanceMeters,
  formatDurationShort,
  formatRouteShort,
  travelModeWord,
  type WalkingRoute
} from '../directions';

describe('decodePolyline', () => {
  it('decodes the canonical Google example', () => {
    // Official example from the encoded-polyline spec:
    // (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points).toHaveLength(3);
    expect(points[0].latitude).toBeCloseTo(38.5, 5);
    expect(points[0].longitude).toBeCloseTo(-120.2, 5);
    expect(points[2].latitude).toBeCloseTo(43.252, 5);
    expect(points[2].longitude).toBeCloseTo(-126.453, 5);
  });

  it('returns an empty list for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('drops out-of-range pairs instead of crashing the native map', () => {
    // A malformed tail must not produce NaN / >90 latitude coordinates
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    for (const point of points) {
      expect(Math.abs(point.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(point.longitude)).toBeLessThanOrEqual(180);
      expect(Number.isFinite(point.latitude)).toBe(true);
      expect(Number.isFinite(point.longitude)).toBe(true);
    }
  });
});

describe('formatDistanceMeters', () => {
  it('uses metres below a kilometre', () => {
    expect(formatDistanceMeters(350)).toBe('350 м');
  });

  it('uses comma-decimal kilometres above a kilometre', () => {
    expect(formatDistanceMeters(1840)).toBe('1,8 км');
  });

  it('returns empty string for null/NaN', () => {
    expect(formatDistanceMeters(null)).toBe('');
    expect(formatDistanceMeters(Number.NaN)).toBe('');
  });
});

describe('formatDurationShort', () => {
  it('formats minutes', () => {
    expect(formatDurationShort(1380)).toBe('23 мин');
  });

  it('never shows zero minutes', () => {
    expect(formatDurationShort(10)).toBe('1 мин');
  });

  it('formats hours with remainder', () => {
    expect(formatDurationShort(4500)).toBe('1 ч 15 мин');
  });
});

function makeRoute(overrides: Partial<WalkingRoute>): WalkingRoute {
  return {
    coordinates: [
      { latitude: 16.06, longitude: 108.22 },
      { latitude: 16.05, longitude: 108.21 }
    ],
    distanceMeters: 1840,
    durationSeconds: 1380,
    roadRoute: true,
    mode: 'walk',
    steps: [],
    ...overrides
  };
}

describe('formatRouteShort', () => {
  it('joins distance and duration', () => {
    expect(formatRouteShort(makeRoute({}))).toBe('1,8 км · ~23 мин');
  });

  it('marks straight-line fallbacks', () => {
    expect(formatRouteShort(makeRoute({ roadRoute: false }))).toBe('1,8 км · ~23 мин (по прямой)');
  });
});

describe('travelModeWord', () => {
  it('maps every mode to a Russian word', () => {
    expect(travelModeWord('walk')).toBe('пешком');
    expect(travelModeWord('scooter')).toBe('на скутере');
    expect(travelModeWord('bike')).toBe('на велосипеде');
    expect(travelModeWord('taxi')).toBe('на такси');
  });
});
