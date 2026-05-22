module.exports = {
  expo: {
    name: 'Da Nang Guide',
    slug: 'danang-guide-native',
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
      package: 'com.danangguide.app',
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
    projectId: "5566a5ae-23eb-4008-8d48-df36560e9489"
  }
      
    }
  }
};
