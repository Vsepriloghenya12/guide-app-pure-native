import { Platform, StatusBar } from 'react-native';
import { API_BASE_URL } from '../api/client';
import type { NativeRoute, TabKey } from '../types/app';
import type { TravelMode, LatLng } from '../utils/directions';

export const tabItems: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'Главная', icon: '⌂' },
  { key: 'search', label: 'Поиск', icon: '⌕' },
  { key: 'nearby', label: 'Карта', icon: '⌖' },
  { key: 'favorites', label: 'Избранное', icon: '♥' },
  { key: 'contacts', label: 'Помощь', icon: '•••' }
];

export const hiddenHomeCategoryIds = new Set(['events']);
export const restaurantQuickFilters = ['Морепродукты', 'Вьетнамская', 'Европейская'];
export const welcomeSeenStorageKey = 'guide-app-welcome-seen-v1';

export const legalBaseUrl = API_BASE_URL.replace(/\/api$/i, '');
export const legalLinks = [
  { id: 'terms', label: 'Пользовательское соглашение', path: '/terms' },
  { id: 'privacy', label: 'Политика конфиденциальности', path: '/privacy' },
  { id: 'delete-profile', label: 'Удаление данных профиля', path: '/delete-profile' },
  { id: 'support', label: 'Поддержка', path: '/support' }
] as const;

export const filterTextMap: Record<string, string> = {
  breakfast: 'Завтраки', vegan: 'Веган-опции', pets: 'Можно с животными', childprograms: 'Для детей',
  nightlife: 'Ночная жизнь', free: 'Бесплатно', outdoor: 'На улице', family: 'Для всей семьи',
  water: 'У воды', bike: 'Байк', car: 'Авто', delivery: 'Доставка', market: 'Рынок', local: 'Локальное',
  design: 'Дизайн', museum: 'Музей', temple: 'Храм', view: 'Вид', english: 'На английском',
  pharmacy: 'Аптека', sunrise: 'Рассвет', sunset: 'Закат', spa: 'СПА', massage: 'Массаж',
  mountains: 'Горы', airport: 'Аэропорт', cash: 'Наличные', center: 'Центр', souvenirs: 'Сувениры',
  culture: 'Культура', history: 'История', kids: 'Детям', emergency: 'Экстренно', hospital: 'Больница',
  photo: 'Фото', coworking: 'Коворкинг', resort: 'Курорт', beach: 'Пляж'
};

export const ANDROID_STATUS_BAR_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
export const ANDROID_NAVIGATION_BAR_INSET = Platform.OS === 'android' ? 34 : 0;
export const BOTTOM_TABS_VISIBLE_HEIGHT = 66 + ANDROID_NAVIGATION_BAR_INSET;

export const TRAVEL_MODES: TravelMode[] = ['walk', 'scooter', 'bike', 'taxi'];
export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = { walk: 'Пешком', scooter: 'Скутер', bike: 'Велосипед', taxi: 'Такси' };
export const EXTERNAL_TRAVEL_MODE: Record<TravelMode, string> = { walk: 'walking', scooter: 'driving', bike: 'bicycling', taxi: 'driving' };
export const DANANG_DEMO_ORIGIN: LatLng = { latitude: 16.0611, longitude: 108.2229 };

export const nativeRoutes: NativeRoute[] = [
  {
    id: 'center-evening',
    title: 'Первый вечер в центре Дананга',
    subtitle: 'Короткая прогулка, еда и Dragon Bridge без сложной логистики.',
    duration: '2-3 часа',
    distance: '3.5 км',
    description: 'Маршрут для первого знакомства с городом: набережная, центр, вечерний мост и спокойный ужин рядом с рекой.',
    sees: ['Набережную Han River', 'Dragon Bridge вечером', 'Кафе и рестораны центра', 'Видовые точки для фото'],
    points: [
      { title: 'Han Market', text: 'Старт в центре, можно быстро купить воду и посмотреть городской рынок.', lat: 16.068, lng: 108.224 },
      { title: 'Набережная Han River', text: 'Прогулка вдоль реки и вид на мосты.', lat: 16.064, lng: 108.226 },
      { title: 'Dragon Bridge', text: 'Главная вечерняя точка маршрута.', lat: 16.061, lng: 108.227 },
      { title: 'Ужин рядом с рекой', text: 'Финал маршрута в ресторане или кафе неподалёку.', lat: 16.06, lng: 108.229 }
    ]
  },
  {
    id: 'sea-and-views',
    title: 'Море и виды города',
    subtitle: 'Пляж, кофе, смотровые точки и спокойный темп.',
    duration: 'полдня',
    distance: '8-12 км',
    description: 'Маршрут для дня у воды: пляж, короткие остановки у моря и красивые виды без перегруза.',
    sees: ['Пляж My Khe', 'Кофейни у моря', 'Панорамные виды', 'Фото-точки на побережье'],
    points: [
      { title: 'My Khe Beach', text: 'Старт с пляжа и прогулки у моря.', lat: 16.061, lng: 108.247 },
      { title: 'Кофейня у пляжа', text: 'Пауза на кофе и лёгкий завтрак.', lat: 16.066, lng: 108.246 },
      { title: 'Son Tra View', text: 'Видовая часть маршрута.', lat: 16.107, lng: 108.263 }
    ]
  },
  {
    id: 'culture-day',
    title: 'Культура и старый город',
    subtitle: 'Храмы, музеи, локальные улицы и спокойные остановки.',
    duration: '4-5 часов',
    distance: '6 км',
    description: 'Маршрут для тех, кто хочет увидеть не только пляжный Дананг, но и культурные точки города.',
    sees: ['Музей', 'Храмовые точки', 'Локальные улицы', 'Кофе-паузы между остановками'],
    points: [
      { title: 'Cham Museum', text: 'Главная культурная точка в центре.', lat: 16.06, lng: 108.223 },
      { title: 'Локальные кварталы', text: 'Короткая прогулка по спокойным улицам.', lat: 16.067, lng: 108.219 },
      { title: 'Кофе и отдых', text: 'Финальная остановка перед возвращением.', lat: 16.071, lng: 108.224 }
    ]
  }
];