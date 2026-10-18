import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './api';

const SAVED = 'faysha.pushToken';

// Updates also arrive over the live connection while the app is open (shown as an in-app banner),
// so a push that lands in the foreground only goes to the notification list.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/**
 * Asks for permission once and registers this device's Expo push token with the server
 * (POST /api/guest/push-token). Quietly does nothing on simulators, without permission, or when the build has
 * no EAS project id (push needs a development or store build, not Expo Go).
 */
export async function registerForPush() {
  try {
    if (!Device.isDevice || Platform.OS === 'web') return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Faysha',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#C8A45D',
        vibrationPattern: [0, 200, 120, 200],
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;
    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiClient.post('/guest/push-token', { token, platform: Platform.OS, device: Device.modelName || undefined });
    await AsyncStorage.setItem(SAVED, token);
    return token;
  } catch (e) {
    console.log('Push registration skipped:', e?.message);
    return null;
  }
}

/** Stops pushes to this device for the signed-in guest (call before signing out). */
export async function unregisterPush() {
  try {
    const token = await AsyncStorage.getItem(SAVED);
    if (!token) return;
    await AsyncStorage.removeItem(SAVED);
    await apiClient.delete('/guest/push-token', { data: { token } });
  } catch {
    // signing out anyway
  }
}

/** Calls onOpen(data) when the guest taps a notification, including the one that launched the app. */
export function onNotificationOpened(onOpen) {
  const handle = (response) => {
    const data = response?.notification?.request?.content?.data;
    if (data) onOpen(data);
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
