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
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#ffffff'
      },
      edgeToEdgeEnabled: false,
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
        projectId: '5d3c1adc-6568-443d-9eb1-b1a829d388ec'
      }
    }
  }
};
