import type { MapStyleElement } from 'react-native-maps';

/**
 * Фоновый цвет под картой: совпадает с плейсхолдером карты в приложении,
 * чтобы тайлы Google подгружались без визуального «скачка».
 */
export const MAP_BG_COLOR = '#e8f1f8';

/**
 * Фирменный стиль Google Maps под палитру приложения:
 * фон #f5f7fb, вода #a9d5ea, акцент #1f63c7, текст #102a43 / #62748b,
 * магистрали в тёплом #ffe0a8 как на дизайн-макетах.
 *
 * Правила настроены вручную: светлая приглушённая основа, минимум лишних
 * иконок и подписей, POI-бизнесы скрыты, парки/достопримечательности/транспорт
 * оставлены, но приглушены.
 */
export const GUIDE_MAP_STYLE: MapStyleElement[] = [
  // --- Основа ---
  { elementType: 'geometry', stylers: [{ color: '#eef1f5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#62748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 2 }] },
  // Глобально гасим иконки — ниже точечно возвращаем нужные.
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // --- Административные границы и названия ---
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c9d4e0' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#102a43' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#7d8da2' }] },

  // --- Ландшафт ---
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#eef1f5' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#dfe5ec' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e8eee6' }] },

  // --- POI: бизнесы прячем, остальное приглушаем ---
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#7d8da2' }] },
  { featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#cbe6c9' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#59855c' }] },
  {
    featureType: 'poi.attraction',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'on' }, { saturation: -45 }, { lightness: 18 }]
  },

  // --- Дороги: белые локальные, тёплые артерии, песочные магистрали ---
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#dfe5ec' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8494a7' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fdfaf2' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#e8e3d5' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffe0a8' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#f0cf8f' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8a6d3b' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#9aa7b8' }] },

  // --- Транспорт: линии тонкие, станции видимы, но сдержанны ---
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#d4dce8' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#62748b' }] },
  {
    featureType: 'transit.station',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'on' }, { saturation: -60 }, { lightness: 12 }]
  },

  // --- Вода ---
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a9d5ea' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4c7ba3' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#a9d5ea' }] }
];
