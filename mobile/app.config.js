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
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
      }
    },
    android: {
      package: 'com.realone14.guideappnativeconnected',
      // Push notifications: FCM config must be wired here so a build from a fresh
      // clone gets push too (EAS file env GOOGLE_SERVICES_JSON supplies the file;
      // local dev falls back to the repo-root copy)
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
      versionCode: 23,
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
      edgeToEdgeEnabled: true,
      softwareKeyboardLayoutMode: 'pan',
      config: {
        googleMaps: {
          // Bare workflow: the effective Android key lives in AndroidManifest.xml;
          // this is kept env-driven for prebuild regeneration consistency
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
        }
      }
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
      telegramBotId: process.env.EXPO_PUBLIC_TELEGRAM_BOT_ID || '',
      pushNotificationsEnabled: process.env.EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED === 'true'
    }
  }
};
