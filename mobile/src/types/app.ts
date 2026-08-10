export type TabKey = 'home' | 'sections' | 'search' | 'favorites' | 'nearby' | 'contacts';

export type Route =
  | { name: 'tabs'; tab: TabKey }
  | { name: 'category'; categoryId: string }
  | { name: 'routes' }
  | { name: 'routeDetail'; routeId: string }
  | { name: 'tips' }
  | { name: 'programs' }
  | { name: 'detail'; slug: string };

export type NativeAuthProviders = {
  google?: boolean;
  apple?: boolean;
  telegram?: boolean;
  telegramBotUsername?: string;
  telegramBotId?: string;
};

export type NativeRoutePoint = { title: string; text: string; lat: number; lng: number };

export type NativeRoute = {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  distance: string;
  description: string;
  sees: string[];
  points: NativeRoutePoint[];
};

export type BulletinPostImage = { uri: string; dataUrl: string; fileName: string };

export type BulletinReportReason = 'spam' | 'illegal' | 'offensive' | 'misleading' | 'other';