const googleMapsApiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();

module.exports = {
  expo: {
    name: 'Da Nang Guide',
    slug: 'guide-app-native-connected',
    scheme: 'danangguide',
    version: '1.0.10',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['assets/**/*'],
    ios: {
      bundleIdentifier: 'com.danangguide.app',
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'Приложение использует геолокацию, чтобы показывать места рядом с вами.'
      }
    },
    android: {
      package: 'com.realone14.guideappnativeconnected',
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
      config: googleMapsApiKey ? {
        googleMaps: {
          apiKey: googleMapsApiKey
        }
      } : undefined,
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#ffffff'
      },
      edgeToEdgeEnabled: false,
      softwareKeyboardLayoutMode: 'pan'
    },
    plugins: [
      'expo-location',
      [
        'expo-image-picker',
        {
          photosPermission: 'Приложение использует доступ к фото, чтобы добавлять изображения к объявлениям.'
        }
      ]
    ],
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    backgroundColor: '#ffffff',
    extra: {
      eas: {
        projectId: '5d3c1adc-6568-443d-9eb1-b1a829d388ec'
      }
    }
  }
};
