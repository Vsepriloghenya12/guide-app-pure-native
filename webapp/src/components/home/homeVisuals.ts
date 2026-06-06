import type { GuideCategory } from '../../types';

const quickIconsById: Partial<Record<GuideCategory['id'], string>> = {
  restaurants: '/home-icons/custom/food.png',
  programs: '/home-icons/custom/programs.png',
  events: '/home-icons/custom/programs.png',
  wellness: '/home-icons/custom/wellness.png',
  hotels: '/home-icons/custom/hotels.png',
  'active-rest': '/home-icons/custom/active-rest.png',
  'car-rental': '/home-icons/custom/car-rental.png',
  atm: '/home-icons/custom/money.png',
  shops: '/home-icons/custom/shopping.png',
  'bulletin-board': '/home-icons/custom/bulletin-board.png',
  culture: '/home-icons/custom/culture.png',
  kids: '/home-icons/custom/kids.png',
  medicine: '/home-icons/custom/medicine.png',
  'photo-spots': '/home-icons/custom/photo-spots.png',
  coworkings: '/home-icons/custom/coworkings.png',
  misc: '/home-icons/custom/misc.png'
};

const orderedQuickIcons = [
  '/home-icons/custom/food.png',
  '/home-icons/custom/programs.png',
  '/home-icons/custom/photo-spots.png',
  '/home-icons/custom/wellness.png',
  '/home-icons/custom/shopping.png'
];

const accentFallback: Record<string, string> = {
  coast: '/icons/icon-512.png',
  sunset: '/icons/icon-512.png',
  bridge: '/home-icons/custom/programs.png',
  emerald: '/home-icons/custom/wellness.png'
};

const toneByCategoryId: Partial<Record<GuideCategory['id'], string>> = {
  restaurants: 'sunset',
  programs: 'bridge',
  wellness: 'emerald',
  'active-rest': 'sunset',
  hotels: 'coast',
  events: 'sunset',
  atm: 'emerald',
  shops: 'sunset',
  'bulletin-board': 'bridge',
  culture: 'coast',
  kids: 'emerald',
  medicine: 'emerald',
  'photo-spots': 'sunset',
  'car-rental': 'bridge',
  coworkings: 'coast',
  misc: 'bridge'
};

export function getQuickMenuImage(category: GuideCategory, index: number): string {
  return quickIconsById[category.id] || orderedQuickIcons[index % orderedQuickIcons.length];
}

export function getQuickMenuFallbackImage(index: number): string {
  return orderedQuickIcons[(index + 1) % orderedQuickIcons.length] || '/icons/icon-512.png';
}

export function getCategoryListImage(category: GuideCategory, index: number): string {
  if (category.imageSrc) {
    return category.imageSrc;
  }

  return quickIconsById[category.id] || accentFallback[category.accent] || orderedQuickIcons[index % orderedQuickIcons.length];
}

export function getCategoryListFallbackImage(category: GuideCategory, index: number): string {
  return quickIconsById[category.id] || accentFallback[category.accent] || getQuickMenuFallbackImage(index);
}

export function getCategoryTone(category: Pick<GuideCategory, 'id' | 'accent'>): string {
  return category.accent || toneByCategoryId[category.id] || 'coast';
}

export function getPlaceTone(categoryId: GuideCategory['id']): string {
  return toneByCategoryId[categoryId] || 'coast';
}
