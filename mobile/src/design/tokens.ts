/**
 * Единственный источник визуальных значений.
 * Ни один компонент не имеет права писать hex, число радиуса или размер шрифта напрямую.
 * Если значения нет здесь — значит его пока не существует в дизайне.
 */

export const color = {
  // поле кадра
  deep: '#08110D',
  field: '#0C1D14',
  fieldLift: '#123024',

  // тёплый белый — основной текст
  warm: '#F4EFE3',
  warm70: 'rgba(244,239,227,0.70)',
  warm60: 'rgba(244,239,227,0.62)',
  warm40: 'rgba(244,239,227,0.38)',
  warm25: 'rgba(244,239,227,0.26)',
  warm19: 'rgba(244,239,227,0.19)',

  // волосяные линии и стеклянные кромки
  hair: 'rgba(244,239,227,0.16)',
  hairBright: 'rgba(244,239,227,0.50)',

  // акценты
  gold: '#E0AC4E',      // знак курации, вьетнамские названия
  amber: '#F2A93B',     // главное действие и включённое состояние
  amberDeep: '#E1901F',
  amberTop: '#F7B854',
  onAmber: '#1B1206',   // текст на янтарном

  // статусы
  open: '#8FD9A8',
  soon: '#E9B15C',
  closed: 'rgba(244,239,227,0.38)',
} as const;

/**
 * Правило: янтарной заливкой в продукте обладает ровно один элемент на экране —
 * главное действие. Включённое состояние любого контрола обозначается
 * светящейся янтарной линией под ним, а не заливкой.
 */
export const accentRule = {
  filledAmberPerScreen: 1,
  activeStateIs: 'underline-glow',
} as const;

export const font = {
  display: 'Prata_400Regular',
  ui: 'Onest_500Medium',
  uiSemi: 'Onest_600SemiBold',
  uiRegular: 'Onest_400Regular',
  viet: 'Manrope_500Medium', // полная вьетнамская диакритика
} as const;

export const text = {
  display:    { fontFamily: font.display, fontSize: 47, lineHeight: 45, letterSpacing: -0.2 },
  displaySm:  { fontFamily: font.display, fontSize: 42, lineHeight: 42, letterSpacing: -0.2 },
  displayXs:  { fontFamily: font.display, fontSize: 23, lineHeight: 25 },
  title:      { fontFamily: font.uiSemi,  fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body:       { fontFamily: font.uiRegular, fontSize: 15, lineHeight: 24 },
  label:      { fontFamily: font.ui,      fontSize: 13.5, lineHeight: 18 },
  lens:       { fontFamily: font.ui,      fontSize: 15, lineHeight: 20 },
  lensOn:     { fontFamily: font.uiSemi,  fontSize: 15, lineHeight: 20 },
  count:      { fontFamily: font.uiSemi,  fontSize: 11.5, lineHeight: 14 },
  micro:      { fontFamily: font.uiSemi,  fontSize: 10.5, lineHeight: 14, letterSpacing: 2.4 },
  viet:       { fontFamily: font.viet,    fontSize: 15, lineHeight: 20, letterSpacing: 0.15 },
  vietSm:     { fontFamily: font.viet,    fontSize: 11.5, lineHeight: 15, letterSpacing: 0.4 },
} as const;

export const radius = {
  frame: 46,
  sheet: 34,
  plate: 26,
  action: 29,
  chip: 22,
  sm: 12,
} as const;

export const space = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, xxl: 28, huge: 34,
} as const;

/** Свечение рисуется радиальным градиентом, а не тенью — см. components/Glow.tsx */
export const glow = {
  action: { color: color.amber, opacity: 0.34, spread: 1.9 },
  ring:   { color: color.gold,  opacity: 0.45, spread: 2.4 },
  line:   { color: color.amber, opacity: 0.85, spread: 3.2 },
  pin:    { color: color.amber, opacity: 0.55, spread: 3.0 },
} as const;

export const motion = {
  press: 130,
  base: 220,
  sheet: 320,
  easeOut: [0.2, 0.8, 0.3, 1] as const,
} as const;

/** Минимальные площади нажатия. Видимого прямоугольника у контрола может не быть — площадь есть всегда. */
export const hit = {
  minHeight: 46,
  minWidth: 88,
  iconOnly: 46,
} as const;

/** Обработка любой фотографии из CMS, чтобы она села в кадр. См. components/PhotoFrame.tsx */
export const photo = {
  darken: 0.30,
  warmGrade: 'rgba(242,169,59,0.06)',
  topScrimHeight: 190,
  topScrimOpacity: 0.62,
  vignetteOpacity: 0.62,
} as const;
