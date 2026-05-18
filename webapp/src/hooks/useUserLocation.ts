import { useCallback, useEffect, useMemo, useState } from 'react';

type StoredUserLocation = {
  lat: number;
  lng: number;
  updatedAt: string;
};

export type UserLocationState = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';

const STORAGE_KEY = 'guide-user-location';

type UseUserLocationResult = {
  state: UserLocationState;
  location: StoredUserLocation | null;
  message: string;
  requestLocation: () => void;
  clearLocation: () => void;
  updatedAtLabel: string;
};

function readStoredLocation(): StoredUserLocation | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredUserLocation>;
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') {
      return null;
    }

    return {
      lat: parsed.lat,
      lng: parsed.lng,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function saveStoredLocation(nextLocation: StoredUserLocation | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!nextLocation) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLocation));
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function useUserLocation(): UseUserLocationResult {
  const initialLocation = useMemo(() => readStoredLocation(), []);
  const [location, setLocation] = useState<StoredUserLocation | null>(initialLocation);
  const [state, setState] = useState<UserLocationState>(initialLocation ? 'ready' : 'idle');
  const [message, setMessage] = useState(
    initialLocation
      ? 'Использую сохранённую геопозицию. Можно обновить точность в любой момент.'
      : 'Разреши геолокацию, чтобы видеть реальные расстояния и сразу строить маршрут.'
  );

  useEffect(() => {
    saveStoredLocation(location);
  }, [location]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState('unsupported');
      setMessage('Этот браузер не поддерживает геолокацию. Всё равно можно открывать карты вручную.');
      return;
    }

    setState('loading');
    setMessage('Определяю текущее местоположение…');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: StoredUserLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          updatedAt: new Date().toISOString()
        };

        setLocation(nextLocation);
        setState('ready');
        setMessage('Геопозиция получена. Можно открывать ближайшие места и маршруты от текущей точки.');
      },
      (error) => {
        setState('error');
        setMessage(error.message || 'Не удалось определить геопозицию. Проверь доступ в браузере.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 120000
      }
    );
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setState('idle');
    setMessage('Геопозиция очищена. Когда понадобится, можно снова включить раздел «Рядом» и маршрут.');
  }, []);

  return {
    state,
    location,
    message,
    requestLocation,
    clearLocation,
    updatedAtLabel: formatUpdatedAt(location?.updatedAt || null)
  };
}
