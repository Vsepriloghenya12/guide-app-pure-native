import type { ImageSourcePropType } from 'react-native';

declare const require: (path: string) => ImageSourcePropType;

export const appLogo = require('../assets/icon.png') as ImageSourcePropType;
export const welcomeBackground = require('../assets/home/welcome-background.png') as ImageSourcePropType;
export const homeHeaderImage = require('../assets/home/home-header-mesto.png') as ImageSourcePropType;
export const placeVerificationBadge = require('../assets/home/place-verification-badge.png') as ImageSourcePropType;

export const categoryIcons: Record<string, ImageSourcePropType> = {
  restaurants: require('../assets/home/home-icons/custom/food.png'),
  programs: require('../assets/home/home-icons/custom/programs.png'),
  routes: require('../assets/home/home-icons/custom/programs.png'),
  wellness: require('../assets/home/home-icons/custom/wellness.png'),
  hotels: require('../assets/home/home-icons/custom/hotels.png'),
  'active-rest': require('../assets/home/home-icons/custom/active-rest.png'),
  'car-rental': require('../assets/home/home-icons/custom/car-rental.png'),
  atm: require('../assets/home/home-icons/custom/money.png'),
  shops: require('../assets/home/home-icons/custom/shopping.png'),
  'bulletin-board': require('../assets/home/home-icons/custom/bulletin-board.png'),
  culture: require('../assets/home/home-icons/custom/culture.png'),
  kids: require('../assets/home/home-icons/custom/kids.png'),
  medicine: require('../assets/home/home-icons/custom/medicine.png'),
  'photo-spots': require('../assets/home/home-icons/custom/photo-spots.png'),
  coworkings: require('../assets/home/home-icons/custom/coworkings.png'),
  misc: require('../assets/home/home-icons/custom/misc.png')
};

export const defaultCategoryIcon = categoryIcons.misc;
