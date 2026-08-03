import Supercluster from 'supercluster';

export type ClusterPoint = { id: string; latitude: number; longitude: number };

export type ClusterNode =
  | { type: 'cluster'; id: number; latitude: number; longitude: number; count: number; expansionZoom: number }
  | { type: 'point'; id: string; latitude: number; longitude: number };

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type PointProps = { pointId: string };

export type ClusterIndex = Supercluster<PointProps>;

const CLUSTER_RADIUS = 52;
const CLUSTER_MAX_ZOOM = 17;
const CLUSTER_MIN_ZOOM = 0;
const MAX_MAP_ZOOM = 20;
/** Web-Mercator caps out around ±85°, дальше bbox не имеет смысла. */
const MAX_LATITUDE = 85;
/** Запас по краям bbox, чтобы маркеры у границ экрана не «выпрыгивали». */
const BBOX_PADDING = 1.2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isValidCoordinate(point: ClusterPoint) {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}

/**
 * Строит индекс кластеризации по точкам карты.
 * Точки с битыми координатами (NaN, за пределами мира) отбрасываются,
 * чтобы не ронять нативную карту.
 */
export function buildClusterIndex(points: ClusterPoint[]): ClusterIndex {
  const index = new Supercluster<PointProps>({
    radius: CLUSTER_RADIUS,
    maxZoom: CLUSTER_MAX_ZOOM,
    minZoom: CLUSTER_MIN_ZOOM
  });

  index.load(
    points.filter(isValidCoordinate).map((point) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.longitude, point.latitude] },
      properties: { pointId: point.id }
    }))
  );

  return index;
}

/** Целочисленный zoom Google-карты для региона react-native-maps. */
export function zoomForLongitudeDelta(longitudeDelta: number): number {
  if (!Number.isFinite(longitudeDelta) || longitudeDelta <= 0) return MAX_MAP_ZOOM;
  return clamp(Math.round(Math.log2(360 / longitudeDelta)), 0, MAX_MAP_ZOOM);
}

/** Обратное преобразование: регион карты, соответствующий zoom-уровню. */
export function regionForZoom(latitude: number, longitude: number, zoom: number): MapRegion {
  const longitudeDelta = 360 / 2 ** clamp(zoom, 0, MAX_MAP_ZOOM);
  return {
    latitude,
    longitude,
    latitudeDelta: longitudeDelta * 0.6,
    longitudeDelta
  };
}

/**
 * Возвращает кластеры и одиночные точки для текущего региона карты.
 * Регион конвертируется в bbox [запад, юг, восток, север] с запасом ~20%.
 */
export function getClusterNodes(index: ClusterIndex, region: MapRegion): ClusterNode[] {
  const zoom = zoomForLongitudeDelta(region.longitudeDelta);
  const halfLat = (region.latitudeDelta / 2) * BBOX_PADDING;
  const halfLng = (region.longitudeDelta / 2) * BBOX_PADDING;
  const west = clamp(region.longitude - halfLng, -180, 180);
  const south = clamp(region.latitude - halfLat, -MAX_LATITUDE, MAX_LATITUDE);
  const east = clamp(region.longitude + halfLng, -180, 180);
  const north = clamp(region.latitude + halfLat, -MAX_LATITUDE, MAX_LATITUDE);

  return index.getClusters([west, south, east, north], zoom).map((feature): ClusterNode => {
    const [longitude, latitude] = feature.geometry.coordinates;
    const props = feature.properties;
    if ('cluster' in props && props.cluster) {
      return {
        type: 'cluster',
        id: props.cluster_id,
        latitude,
        longitude,
        count: props.point_count,
        expansionZoom: clamp(index.getClusterExpansionZoom(props.cluster_id), 0, MAX_MAP_ZOOM)
      };
    }
    return { type: 'point', id: props.pointId, latitude, longitude };
  });
}
