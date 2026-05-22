import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

// Ignore specific warnings/errors on the screen
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);

// Override console warnings/errors to filter them out of the terminal logs
if (typeof console !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const firstArg = args[0];
    if (
      typeof firstArg === 'string' &&
      (firstArg.includes('expo-notifications') || 
       firstArg.includes('supported in Expo Go') ||
       firstArg.includes('shouldShowAlert is deprecated'))
    ) {
      return;
    }
    originalWarn(...args);
  };

  const originalError = console.error;
  console.error = (...args: any[]) => {
    const firstArg = args[0];
    if (
      typeof firstArg === 'string' &&
      (firstArg.includes('expo-notifications: Android Push notifications') ||
       firstArg.includes('supported in Expo Go'))
    ) {
      return;
    }
    originalError(...args);
  };
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
