const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

module.exports = {
  expo: {
    name: 'Da Nang Guide',
    slug: 'danang-guide-native',
    scheme: 'danangguide',
    version: '1.0.9',
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
      package: 'com.danangguide.app',
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#ffffff'
      },
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey
        }
      },
      edgeToEdgeEnabled: true,
      softwareKeyboardLayoutMode: 'pan'
    },
    plugins: ['expo-location'],
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    backgroundColor: '#ffffff',
    extra: {
      eas: {
        projectId: 'd697fc4e-d6c5-4af0-b7c9-fd9b76bccc18'
      }
    }
  }
};
