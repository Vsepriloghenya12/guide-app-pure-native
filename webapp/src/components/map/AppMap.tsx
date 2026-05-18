import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CategoryIcon } from '../common/CategoryIcon';
import type { Category, Listing } from '../../types';
import {
  DANANG_MAP_CENTER,
  DANANG_PUBLIC_MAP_ZOOM,
  getOsmTiles,
  hasAppMapCoordinates,
  latLngToWorldPixel,
  projectLatLngToTileMap,
  projectTileMapPointToLatLng,
  type AppMapPoint,
  type AppMapSize,
  worldPixelToLatLng
} from '../../utils/appMap';
import { createGoogleDirectionsUrl, formatDistance } from '../../utils/places';

type AppMapListing = Listing & {
  category?: Category;
  distanceKm?: number | null;
};

type AppMapProps = {
  places: AppMapListing[];
  selectedPlaceId: string | null;
  userLocation?: AppMapPoint | null;
  emptyMessage?: string;
  onSelectPlace: (placeId: string) => void;
  onClearSelectedPlace?: () => void;
};

type DragState = {
  pointerId: number;
  lastX: number;
  lastY: number;
};

type PointerPosition = {
  x: number;
  y: number;
};

type PinchState = {
  distance: number;
  midX: number;
  midY: number;
};

const MIN_PUBLIC_ZOOM = 11;
const MAX_PUBLIC_ZOOM = 18;
const PINCH_ZOOM_IN_RATIO = 1.12;
const PINCH_ZOOM_OUT_RATIO = 0.9;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<AppMapSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return { ref, size };
}

function isPointVisible(point: { x: number; y: number }, size: AppMapSize) {
  return point.x > -80 && point.x < size.width + 80 && point.y > -90 && point.y < size.height + 80;
}

function getMarkerLabel(place: AppMapListing) {
  const categoryLabel = place.category?.shortTitle || place.category?.title || 'Место';
  return `${place.title}. ${categoryLabel}`;
}

function shiftCenter(center: AppMapPoint, zoom: number, deltaX: number, deltaY: number) {
  const centerPixel = latLngToWorldPixel(center, zoom);
  return worldPixelToLatLng(
    {
      x: centerPixel.x - deltaX,
      y: centerPixel.y - deltaY
    },
    zoom
  );
}

function getCenterForZoomAroundPoint(
  center: AppMapPoint,
  fromZoom: number,
  toZoom: number,
  localPoint: PointerPosition,
  size: AppMapSize
) {
  const anchor = projectTileMapPointToLatLng(localPoint, center, fromZoom, size);
  const anchorPixel = latLngToWorldPixel(anchor, toZoom);

  return worldPixelToLatLng(
    {
      x: anchorPixel.x - localPoint.x + size.width / 2,
      y: anchorPixel.y - localPoint.y + size.height / 2
    },
    toZoom
  );
}

function getLocalPoint(element: HTMLElement, clientX: number, clientY: number): PointerPosition {
  const rect = element.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function getPinchState(pointers: Map<number, PointerPosition>): PinchState | null {
  const activePointers = Array.from(pointers.values());
  if (activePointers.length < 2) {
    return null;
  }

  const [first, second] = activePointers;
  return {
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    midX: (first.x + second.x) / 2,
    midY: (first.y + second.y) / 2
  };
}

export function AppMap({ places, selectedPlaceId, userLocation, emptyMessage, onSelectPlace, onClearSelectedPlace }: AppMapProps) {
  const { ref: canvasRef, size } = useElementSize<HTMLDivElement>();
  const [mapCenter, setMapCenter] = useState<AppMapPoint>(DANANG_MAP_CENTER);
  const [zoom, setZoom] = useState(DANANG_PUBLIC_MAP_ZOOM);
  const dragRef = useRef<DragState | null>(null);
  const activePointersRef = useRef<Map<number, PointerPosition>>(new Map());
  const pinchRef = useRef<PinchState | null>(null);
  const mapCenterRef = useRef<AppMapPoint>(mapCenter);
  const zoomRef = useRef(zoom);
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? null;

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) {
      return undefined;
    }

    const shouldIgnoreTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      return Boolean(target.closest('.app-map-zoom-controls, .app-map-attribution, .app-map-marker, button, a'));
    };

    const preventPageGesture = (event: TouchEvent | WheelEvent) => {
      if (shouldIgnoreTarget(event.target)) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    element.addEventListener('touchstart', preventPageGesture, { passive: false });
    element.addEventListener('touchmove', preventPageGesture, { passive: false });
    element.addEventListener('wheel', preventPageGesture, { passive: false });

    return () => {
      element.removeEventListener('touchstart', preventPageGesture);
      element.removeEventListener('touchmove', preventPageGesture);
      element.removeEventListener('wheel', preventPageGesture);
    };
  }, [canvasRef]);

  useEffect(() => {
    if (selectedPlace && hasAppMapCoordinates(selectedPlace)) {
      const nextCenter = { lat: selectedPlace.lat, lng: selectedPlace.lng };
      mapCenterRef.current = nextCenter;
      setMapCenter(nextCenter);
    }
  }, [selectedPlace?.id]);

  const tiles = useMemo(() => getOsmTiles(mapCenter, zoom, size), [mapCenter, zoom, size]);
  const userPoint = userLocation && size.width ? projectLatLngToTileMap(userLocation, mapCenter, zoom, size) : null;

  const applyPan = (deltaX: number, deltaY: number) => {
    const nextCenter = shiftCenter(mapCenterRef.current, zoomRef.current, deltaX, deltaY);
    mapCenterRef.current = nextCenter;
    setMapCenter(nextCenter);
  };

  const applyZoomAtPoint = (localPoint: PointerPosition, direction: 1 | -1) => {
    if (!size.width || !size.height) {
      return;
    }

    const nextZoom = clamp(zoomRef.current + direction, MIN_PUBLIC_ZOOM, MAX_PUBLIC_ZOOM);
    if (nextZoom === zoomRef.current) {
      return;
    }

    const nextCenter = getCenterForZoomAroundPoint(mapCenterRef.current, zoomRef.current, nextZoom, localPoint, size);
    zoomRef.current = nextZoom;
    mapCenterRef.current = nextCenter;
    setZoom(nextZoom);
    setMapCenter(nextCenter);
  };

  const applyZoomAtClientPosition = (element: HTMLElement, clientX: number, clientY: number, direction: 1 | -1) => {
    applyZoomAtPoint(getLocalPoint(element, clientX, clientY), direction);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (activePointersRef.current.size >= 2) {
      dragRef.current = null;
      pinchRef.current = getPinchState(activePointersRef.current);
      return;
    }

    pinchRef.current = null;
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointersRef.current.size >= 2) {
      const previousPinch = pinchRef.current;
      const nextPinch = getPinchState(activePointersRef.current);
      if (!previousPinch || !nextPinch) {
        pinchRef.current = nextPinch;
        return;
      }

      const midpointDeltaX = nextPinch.midX - previousPinch.midX;
      const midpointDeltaY = nextPinch.midY - previousPinch.midY;
      if (Math.abs(midpointDeltaX) > 0.5 || Math.abs(midpointDeltaY) > 0.5) {
        applyPan(midpointDeltaX, midpointDeltaY);
      }

      const ratio = nextPinch.distance / Math.max(previousPinch.distance, 1);
      let baseDistance = previousPinch.distance;
      if (ratio >= PINCH_ZOOM_IN_RATIO) {
        applyZoomAtClientPosition(event.currentTarget, nextPinch.midX, nextPinch.midY, 1);
        baseDistance = nextPinch.distance;
      } else if (ratio <= PINCH_ZOOM_OUT_RATIO) {
        applyZoomAtClientPosition(event.currentTarget, nextPinch.midX, nextPinch.midY, -1);
        baseDistance = nextPinch.distance;
      }

      pinchRef.current = { distance: baseDistance, midX: nextPinch.midX, midY: nextPinch.midY };
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
      return;
    }

    dragRef.current = { ...drag, lastX: event.clientX, lastY: event.clientY };
    applyPan(deltaX, deltaY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);

    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }

    pinchRef.current = activePointersRef.current.size >= 2 ? getPinchState(activePointersRef.current) : null;
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const direction = event.deltaY > 0 ? -1 : 1;
    applyZoomAtClientPosition(event.currentTarget, event.clientX, event.clientY, direction);
  };

  const changeZoom = (direction: 1 | -1) => {
    applyZoomAtPoint({ x: size.width / 2, y: size.height / 2 }, direction);
  };

  const resetMap = () => {
    const nextCenter = selectedPlace && hasAppMapCoordinates(selectedPlace) ? { lat: selectedPlace.lat, lng: selectedPlace.lng } : DANANG_MAP_CENTER;
    mapCenterRef.current = nextCenter;
    zoomRef.current = DANANG_PUBLIC_MAP_ZOOM;
    setMapCenter(nextCenter);
    setZoom(DANANG_PUBLIC_MAP_ZOOM);
  };

  return (
    <section className={`app-map-shell app-map-shell--osm${selectedPlace ? ' has-selected-place' : ''}`} aria-label="Карта приложения">
      <div
        ref={canvasRef}
        className="app-map-canvas app-map-canvas--osm"
        role="application"
        aria-label="Интерактивная карта Дананга с отмеченными местами"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="app-map-tile-layer" aria-hidden="true">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              className="app-map-tile"
              src={tile.url}
              alt=""
              draggable={false}
              loading="eager"
              style={{ width: tile.size, height: tile.size, left: tile.left, top: tile.top }}
            />
          ))}
        </div>

        <div className="app-map-real-overlay" aria-hidden="true" />
        <div className="app-map-compass" aria-hidden="true">N</div>
        <div className="app-map-zoom-controls" aria-label="Управление картой" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => changeZoom(1)} aria-label="Увеличить карту">+</button>
          <button type="button" onClick={() => changeZoom(-1)} aria-label="Уменьшить карту">−</button>
          <button type="button" onClick={resetMap} aria-label="Вернуть карту к Данангу">⌖</button>
        </div>

        {places.length === 0 && emptyMessage ? <div className="app-map-empty-note">{emptyMessage}</div> : null}

        {userPoint && isPointVisible(userPoint, size) ? (
          <span
            className="app-map-user-point"
            style={{ left: `${userPoint.x}px`, top: `${userPoint.y}px` }}
            title="Вы здесь"
            aria-label="Ваше местоположение"
          />
        ) : null}

        <div className="app-map-marker-layer">
          {places.map((place) => {
            if (!hasAppMapCoordinates(place) || !size.width) {
              return null;
            }

            const point = projectLatLngToTileMap({ lat: place.lat, lng: place.lng }, mapCenter, zoom, size);
            if (!isPointVisible(point, size)) {
              return null;
            }

            const isSelected = place.id === selectedPlace?.id;
            return (
              <button
                key={place.id}
                className={`app-map-marker${isSelected ? ' is-selected' : ''}`}
                type="button"
                style={{ left: `${point.x}px`, top: `${point.y}px` }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectPlace(place.id);
                }}
                aria-label={getMarkerLabel(place)}
                data-tone={place.category?.accent || 'coast'}
              >
                <span className="app-map-marker__icon">
                  <CategoryIcon categoryId={place.categoryId} size="sm" />
                </span>
                <span className="app-map-marker__pulse" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <a className="app-map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onPointerDown={(event) => event.stopPropagation()}>
          © OpenStreetMap
        </a>
      </div>

      {selectedPlace ? (
        <article className="app-map-place-sheet" data-tone={selectedPlace.category?.accent || 'coast'}>
          {onClearSelectedPlace ? (
            <button className="app-map-place-sheet__close" type="button" onClick={onClearSelectedPlace} aria-label="Закрыть карточку места">
              ×
            </button>
          ) : null}
          <div className="app-map-place-sheet__image">
            <img src={selectedPlace.coverImageUrl || selectedPlace.imageUrls?.[0] || '/home-hero-background.png'} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="app-map-place-sheet__body">
            <span>{selectedPlace.category?.shortTitle || selectedPlace.category?.title || 'Место'}</span>
            <strong>{selectedPlace.title}</strong>
            <p>{selectedPlace.district || selectedPlace.shortDescription || selectedPlace.description}</p>
            <div className="app-map-place-sheet__meta">
              {selectedPlace.distanceKm !== null && selectedPlace.distanceKm !== undefined ? <small>{formatDistance(selectedPlace.distanceKm)}</small> : null}
            </div>
            <div className="app-map-place-sheet__actions">
              <Link className="travel-primary-button" to={`/place/${selectedPlace.slug}`}>
                Открыть
              </Link>
              <a className="travel-secondary-button" href={createGoogleDirectionsUrl(selectedPlace, userLocation)} target="_blank" rel="noreferrer">
                Маршрут
              </a>
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}
