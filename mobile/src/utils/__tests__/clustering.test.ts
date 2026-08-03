import { describe, expect, it } from 'vitest';
import {
  buildClusterIndex,
  getClusterNodes,
  regionForZoom,
  zoomForLongitudeDelta,
  type ClusterPoint,
  type MapRegion
} from '../clustering';

const DA_NANG = { latitude: 16.0544, longitude: 108.2022 };

const CITY_REGION: MapRegion = {
  ...DA_NANG,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2
};

/** Плотное пятно из `count` точек в радиусе ~50 м вокруг центра. */
function makeBlob(count: number, center: { latitude: number; longitude: number }, prefix: string): ClusterPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI;
    const radius = 0.0001 + (i / count) * 0.0003;
    return {
      id: `${prefix}-${i}`,
      latitude: center.latitude + radius * Math.cos(angle),
      longitude: center.longitude + radius * Math.sin(angle)
    };
  });
}

describe('buildClusterIndex + getClusterNodes', () => {
  it('collapses a tight 100m blob into a single cluster at city zoom', () => {
    const index = buildClusterIndex(makeBlob(30, DA_NANG, 'blob'));
    const nodes = getClusterNodes(index, CITY_REGION);

    expect(nodes).toHaveLength(1);
    const node = nodes[0];
    expect(node.type).toBe('cluster');
    if (node.type !== 'cluster') return;
    expect(node.count).toBe(30);
    expect(node.latitude).toBeCloseTo(DA_NANG.latitude, 2);
    expect(node.longitude).toBeCloseTo(DA_NANG.longitude, 2);
    // По клику на кластер карта должна уходить глубже текущего zoom (~11)
    expect(node.expansionZoom).toBeGreaterThan(zoomForLongitudeDelta(CITY_REGION.longitudeDelta));
    expect(node.expansionZoom).toBeLessThanOrEqual(20);
  });

  it('explodes the same blob into 30 individual points at zoom 18', () => {
    const points = makeBlob(30, DA_NANG, 'blob');
    const index = buildClusterIndex(points);
    const nodes = getClusterNodes(index, regionForZoom(DA_NANG.latitude, DA_NANG.longitude, 18));

    expect(nodes).toHaveLength(30);
    expect(nodes.every((node) => node.type === 'point')).toBe(true);
    const ids = new Set(nodes.map((node) => (node.type === 'point' ? node.id : '')));
    for (const point of points) {
      expect(ids.has(point.id)).toBe(true);
    }
  });

  it('keeps two blobs 5km apart as two separate clusters at city zoom', () => {
    // ~5 км по широте ≈ 0.045°
    const north = makeBlob(15, { latitude: 16.0769, longitude: 108.2022 }, 'north');
    const south = makeBlob(15, { latitude: 16.0319, longitude: 108.2022 }, 'south');
    const index = buildClusterIndex([...north, ...south]);
    const nodes = getClusterNodes(index, CITY_REGION);

    expect(nodes).toHaveLength(2);
    expect(nodes.every((node) => node.type === 'cluster')).toBe(true);
    const counts = nodes
      .map((node) => (node.type === 'cluster' ? node.count : 0))
      .sort((a, b) => a - b);
    expect(counts).toEqual([15, 15]);
  });

  it('returns an empty list for empty input', () => {
    const index = buildClusterIndex([]);
    expect(getClusterNodes(index, CITY_REGION)).toEqual([]);
  });

  it('never clusters a single point', () => {
    const index = buildClusterIndex([{ id: 'solo', ...DA_NANG }]);
    const nodes = getClusterNodes(index, CITY_REGION);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'point', id: 'solo' });
  });

  it('filters out invalid coordinates instead of crashing', () => {
    const index = buildClusterIndex([
      { id: 'ok', ...DA_NANG },
      { id: 'nan', latitude: Number.NaN, longitude: 108.2 },
      { id: 'space', latitude: 91, longitude: 108.2 },
      { id: 'wrapped', latitude: 16.05, longitude: 181 }
    ]);
    const nodes = getClusterNodes(index, CITY_REGION);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: 'point', id: 'ok' });
  });
});

describe('zoomForLongitudeDelta + regionForZoom', () => {
  it('roundtrips region → zoom → region for every practical zoom level', () => {
    for (let zoom = 3; zoom <= 18; zoom += 1) {
      const region = regionForZoom(DA_NANG.latitude, DA_NANG.longitude, zoom);
      expect(zoomForLongitudeDelta(region.longitudeDelta)).toBe(zoom);
    }
  });

  it('is monotonic: wider regions map to lower zooms', () => {
    const deltas = [0.005, 0.02, 0.2, 1, 10, 90];
    const zooms = deltas.map(zoomForLongitudeDelta);
    for (let i = 1; i < zooms.length; i += 1) {
      expect(zooms[i]).toBeLessThan(zooms[i - 1]);
    }
  });

  it('treats degenerate deltas as maximum zoom', () => {
    expect(zoomForLongitudeDelta(0)).toBe(20);
    expect(zoomForLongitudeDelta(Number.NaN)).toBe(20);
  });

  it('produces a portrait-ish region centered on the requested point', () => {
    const region = regionForZoom(DA_NANG.latitude, DA_NANG.longitude, 12);
    expect(region.latitude).toBe(DA_NANG.latitude);
    expect(region.longitude).toBe(DA_NANG.longitude);
    expect(region.longitudeDelta).toBeCloseTo(360 / 2 ** 12, 10);
    expect(region.latitudeDelta).toBeCloseTo(region.longitudeDelta * 0.6, 10);
  });
});
