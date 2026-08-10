// 6 палитр от часов суток. Компоненты читают токены, вёрстка не меняется никогда.
export type BucketKey = 'dawn' | 'morning' | 'day' | 'sunset' | 'evening' | 'night';

export interface ThemeTokens {
  bucket: BucketKey;
  page: string; // фон экрана
  fg: string;   // основной текст
  dim: string;  // приглушённый текст
  hair: string; // волосяные линии/бордеры
  acc: string;  // янтарный акцент
  nav: string;  // фон таб-бара
  card: string; // фон карточек
  cardBorder: string;
}

export const BUCKETS: Record<BucketKey, ThemeTokens> = {
  dawn:    { bucket: 'dawn',    page: '#f2edea', fg: '#2b2530', dim: 'rgba(43,37,48,.62)',   hair: 'rgba(43,37,48,.16)',   acc: '#b96a24', nav: 'rgba(246,241,238,.92)', card: '#ffffff', cardBorder: 'rgba(43,37,48,.12)' },
  morning: { bucket: 'morning', page: '#f1f4f5', fg: '#182430', dim: 'rgba(24,36,48,.62)',   hair: 'rgba(24,36,48,.16)',   acc: '#b96a24', nav: 'rgba(244,247,248,.92)', card: '#ffffff', cardBorder: 'rgba(24,36,48,.12)' },
  day:     { bucket: 'day',     page: '#f7f3ea', fg: '#221a10', dim: 'rgba(34,26,16,.62)',   hair: 'rgba(34,26,16,.16)',   acc: '#b96a24', nav: 'rgba(249,244,235,.92)', card: '#fffdf6', cardBorder: 'rgba(34,26,16,.12)' },
  sunset:  { bucket: 'sunset',  page: '#191310', fg: '#f2e7da', dim: 'rgba(242,231,218,.62)', hair: 'rgba(242,231,218,.24)', acc: '#f0a35c', nav: 'rgba(22,17,13,.92)',  card: '#241b15', cardBorder: 'rgba(242,231,218,.16)' },
  evening: { bucket: 'evening', page: '#0b1118', fg: '#e9eff2', dim: 'rgba(233,239,242,.62)', hair: 'rgba(233,239,242,.28)', acc: '#f0a35c', nav: 'rgba(9,14,20,.92)',   card: '#131a24', cardBorder: 'rgba(233,239,242,.14)' },
  night:   { bucket: 'night',   page: '#0a0e15', fg: '#dfe8f2', dim: 'rgba(223,232,242,.58)', hair: 'rgba(223,232,242,.24)', acc: '#f0a35c', nav: 'rgba(8,11,17,.92)',   card: '#10151d', cardBorder: 'rgba(223,232,242,.12)' },
};

export function bucketByHour(h: number): BucketKey {
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'day';
  if (h >= 16 && h < 19) return 'sunset';
  if (h >= 19 && h < 22) return 'evening';
  return 'night';
}