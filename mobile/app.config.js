module.exports = {
  expo: {
    name: 'Da Nang Guide',
    slug: 'guide-app-native-connected',
    scheme: 'danangguide',
    version: '1.0.17',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['assets/**/*'],
    ios: {
      bundleIdentifier: 'com.danangguide.app',
      supportsTablet: true,
      usesAppleSignIn: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'Приложение использует геолокацию, чтобы показывать места рядом с вами.'
      }
    },
    android: {
      package: 'com.realone14.guideappnativeconnected',
      versionCode: 8,
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS'],
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.VIBRATE'
      ],
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#ffffff'
      },
      edgeToEdgeEnabled: false,
      softwareKeyboardLayoutMode: 'pan'
    },
    plugins: [
      'expo-location',
      'expo-notifications',
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
      },
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://guide-app-pure-native-production.up.railway.app',
      mapTileUrl: process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      telegramBotId: process.env.EXPO_PUBLIC_TELEGRAM_BOT_ID || ''
    }
  }
};
