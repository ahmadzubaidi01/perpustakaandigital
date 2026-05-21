import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Determine if we are running in the standard Expo Go client app
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Set up background and foreground notification behavior
try {
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (error) {
  console.warn('[NotificationService] Failed to set notification handler:', error);
}


export async function registerForPushNotificationsAsync(): Promise<boolean> {
  try {
    const Notifications = require('expo-notifications');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const existingPermissions = await Notifications.getPermissionsAsync() as any;
    const existingStatus = existingPermissions.status || (existingPermissions.granted ? 'granted' : 'denied');
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const requestPermissions = await Notifications.requestPermissionsAsync() as any;
      finalStatus = requestPermissions.status || (requestPermissions.granted ? 'granted' : 'denied');
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.warn('[NotificationService] Failed to register push notifications:', error);
    return false;
  }
}

/**
 * Instantly trigger an OS-level local notification on the device.
 */
export async function triggerLocalNotification(title: string, body: string, data?: Record<string, any>): Promise<string> {
  if (isExpoGo) {
    console.log(`💡 [Expo Go Local Alert] Title: "${title}" | Body: "${body}"`);
  }
  try {
    const Notifications = require('expo-notifications');
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // Display immediately
    });
  } catch (error) {
    console.error('[NotificationService] Failed to trigger local notification:', error);
    return '';
  }
}

