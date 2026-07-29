import { describe, expect, it } from 'vitest';
import { estimateTravelTime, formatDistance, hasCoordinates, haversineDistanceKm } from '../geo';

describe('haversineDistanceKm', () => {
  it('is zero for identical points', () => {
    const point = { lat: 16.0544, lng: 108.2022 };
    expect(haversineDistanceKm(point, point)).toBe(0);
  });

  it('matches the known Dragon Bridge → Han Market distance (~1.1 km)', () => {
    const dragonBridge = { lat: 16.0611, lng: 108.2275 };
    const hanMarket = { lat: 16.0678, lng: 108.2237 };
    const km = haversineDistanceKm(dragonBridge, hanMarket);
    expect(km).toBeGreaterThan(0.5);
    expect(km).toBeLessThan(1.5);
  });

  it('Da Nang → null island is ~11950 km (the famous GPS-failure distance)', () => {
    const daNang = { lat: 16.06, lng: 108.22 };
    const nullIsland = { lat: 0, lng: 0 };
    const km = haversineDistanceKm(daNang, nullIsland);
    expect(km).toBeGreaterThan(11800);
    expect(km).toBeLessThan(12100);
  });
});

describe('formatDistance', () => {
  it('uses metres below a kilometre', () => {
    expect(formatDistance(0.4)).toBe('400 м');
  });

  it('uses one decimal below 10 km', () => {
    expect(formatDistance(1.84)).toBe('1.8 км');
  });

  it('handles null', () => {
    expect(formatDistance(null)).toBe('Нет расстояния');
  });
});

describe('estimateTravelTime', () => {
  it('returns empty for null', () => {
    expect(estimateTravelTime(null)).toBe('');
  });

  it('never returns zero minutes', () => {
    expect(estimateTravelTime(0.01)).toBe('1 мин');
  });
});

describe('hasCoordinates', () => {
  it('accepts finite numbers', () => {
    expect(hasCoordinates({ lat: 16, lng: 108 })).toBe(true);
  });

  it('rejects missing or non-finite values', () => {
    expect(hasCoordinates({})).toBe(false);
    expect(hasCoordinates({ lat: Number.NaN, lng: 108 })).toBe(false);
  });
});
