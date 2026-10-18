import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Where the sign-in lives on the device: the token in the secure keychain/keystore, the profile in AsyncStorage.
 * (On web, where there is no secure store, the token falls back to AsyncStorage.)
 */
const TOKEN = 'faysha.token';
const USER = 'faysha.user';
const secure = Platform.OS !== 'web';

let cachedToken;

export async function getToken() {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = secure ? await SecureStore.getItemAsync(TOKEN) : await AsyncStorage.getItem(TOKEN);
    if (!cachedToken) {
      // The v1 app kept the token in AsyncStorage as "authToken": carry it over once.
      const legacy = await AsyncStorage.getItem('authToken');
      if (legacy) {
        await setToken(legacy);
        await AsyncStorage.multiRemove(['authToken', 'user']);
      }
    }
  } catch {
    cachedToken = null;
  }
  return cachedToken || null;
}

export async function setToken(token) {
  cachedToken = token || null;
  if (!token) return clearToken();
  if (secure) await SecureStore.setItemAsync(TOKEN, token);
  else await AsyncStorage.setItem(TOKEN, token);
}

async function clearToken() {
  cachedToken = null;
  try {
    if (secure) await SecureStore.deleteItemAsync(TOKEN);
    else await AsyncStorage.removeItem(TOKEN);
  } catch {
    // nothing stored
  }
}

export async function getUser() {
  try {
    const json = await AsyncStorage.getItem(USER);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export async function setUser(user) {
  if (user) await AsyncStorage.setItem(USER, JSON.stringify(user));
  else await AsyncStorage.removeItem(USER);
}

export async function clearSession() {
  await clearToken();
  await AsyncStorage.removeItem(USER);
}
