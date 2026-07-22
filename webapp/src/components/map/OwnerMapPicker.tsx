import { KeyboardEvent, memo, useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { api } from '../../api/client';
import { DANANG_MAP_CENTER, type AppMapPoint } from '../../utils/appMap';

type OwnerMapPickerProps = {
  value: AppMapPoint | null;
  searchValue?: string;
  disabled?: boolean;
  onChange: (point: AppMapPoint | null) => void;
};

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDTDtz5ZdNanN19XgrAULyCeBSOe948qaU';

const DEFAULT_ZOOM = 14;
const MAP_CONTAINER_STYLE = { width: '100%', height: '400px' };

const OwnerMapPickerComponent = function OwnerMapPicker({
  value,
  searchValue,
  disabled,
  onChange,
}: OwnerMapPickerProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const initialValueRef = useRef(value);
  const [addressQuery, setAddressQuery] = useState(searchValue ?? '');
  const [geocodeStatus, setGeocodeStatus] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (!addressQuery.trim() && searchValue) {
      setAddressQuery(searchValue);
    }
  }, [addressQuery, searchValue]);

  // Pan to value when it changes externally
  useEffect(() => {
    if (value && mapRef.current) {
      mapRef.current.panTo({ lat: value.lat, lng: value.lng });
    }
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (initialValueRef.current) {
      map.setCenter({ lat: initialValueRef.current.lat, lng: initialValueRef.current.lng });
    }
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onChange({
        lat: Number(e.latLng.lat().toFixed(6)),
        lng: Number(e.latLng.lng().toFixed(6)),
      });
    },
    [onChange]
  );

  const applyGeocodedPoint = (point: AppMapPoint, message: string) => {
    const nextPoint = {
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
    };
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom() ?? DEFAULT_ZOOM;
      mapRef.current.setZoom(Math.max(currentZoom, 16));
      mapRef.current.panTo(nextPoint);
    }
    onChange(nextPoint);
    setGeocodeStatus(message);
  };

  const handleAddressSearch = async () => {
    const query = addressQuery.trim();
    if (!query || disabled || isGeocoding) return;
    setIsGeocoding(true);
    setGeocodeStatus('Ищу адрес...');
    try {
      const response = await api.ownerGeocode(query);
      applyGeocodedPoint(
        { lat: response.result.lat, lng: response.result.lng },
        response.result.provider === 'coordinates'
          ? 'Метка поставлена по координатам.'
          : `Метка поставлена: ${response.result.formattedAddress}`
      );
    } catch (error) {
      setGeocodeStatus(error instanceof Error ? error.message : 'Не удалось найти адрес.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleAddressKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    void handleAddressSearch();
  };

  return (
    <section className="owner-map-picker" aria-label="Точка на карте приложения">
      <div className="owner-map-picker__header">
        <div>
          <strong>Точка на карте</strong>
          <span>Введите адрес, вставьте ссылку на карту или поставьте метку вручную нажатием на карту.</span>
        </div>
        {value ? (
          <button className="button button--ghost" type="button" onClick={() => onChange(null)} disabled={disabled}>
            Убрать метку
          </button>
        ) : null}
      </div>
      <div className="owner-map-picker__search">
        <label className="field">
          <span>Адрес или ссылка на карту</span>
          <input
            value={addressQuery}
            onChange={(event) => setAddressQuery(event.target.value)}
            onKeyDown={handleAddressKeyDown}
            placeholder="Например: Dragon Bridge, Da Nang"
            disabled={disabled || isGeocoding}
          />
        </label>
        <button
          className="button button--primary"
          type="button"
          onClick={() => void handleAddressSearch()}
          disabled={disabled || isGeocoding || !addressQuery.trim()}
        >
          {isGeocoding ? 'Ищу...' : 'Найти и поставить метку'}
        </button>
      </div>
      {geocodeStatus ? <p className="owner-map-picker__status">{geocodeStatus}</p> : null}

      {!isLoaded ? (
        <div
          className="owner-map-picker__gmap"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}
        >
          <span>Загрузка карты...</span>
        </div>
      ) : (
        <GoogleMap
          mapContainerClassName={`owner-map-picker__gmap${disabled ? ' is-disabled' : ''}`}
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={DANANG_MAP_CENTER}
          zoom={DEFAULT_ZOOM}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={disabled ? undefined : handleMapClick}
          options={{
            gestureHandling: 'greedy',
            clickableIcons: false,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false
          }}
        >
          {value && <MarkerF position={{ lat: value.lat, lng: value.lng }} />}
        </GoogleMap>
      )}
    </section>
  );
};

export const OwnerMapPicker = memo(
  OwnerMapPickerComponent,
  (previousProps, nextProps) =>
    previousProps.disabled === nextProps.disabled &&
    previousProps.searchValue === nextProps.searchValue &&
    previousProps.onChange === nextProps.onChange &&
    (previousProps.value?.lat ?? null) === (nextProps.value?.lat ?? null) &&
    (previousProps.value?.lng ?? null) === (nextProps.value?.lng ?? null)
);
