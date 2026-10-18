import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import apiClient from '../services/api';
import { getToken } from '../services/session';
import { registerForPush, onNotificationOpened } from '../services/push';
import { navigationRef, openScreen } from '../navigation/navigationRef';
import { SERVER_URL } from '../config';
import { COLORS, FONTS } from '../constants/theme';

/**
 * The live link to Faysha while the app is open:
 * - one Socket.io connection (signed in with the guest's token) that screens subscribe to with useLiveEvent;
 * - the concierge unread count;
 * - an in-app banner for updates from staff (request progress, dining, rides, booking confirmation, messages);
 * - push notification registration, and opening the right screen when a notification is tapped.
 */
const LiveContext = createContext(null);

const LAST_READ = 'faysha.lastReadMessageId';
/** Socket events that carry { title, body, screen } and deserve a banner. */
const BANNER_EVENTS = ['message:push', 'request:updated', 'dining:updated', 'transfer:updated', 'stay:confirmed', 'guest:notification'];

export const useLive = () => {
  const context = useContext(LiveContext);
  if (!context) throw new Error('useLive must be used within LiveProvider');
  return context;
};

/** The v1 name, still used by the concierge and home screens. */
export const useChat = useLive;

/** Runs handler(payload) for a socket event while the component is mounted. */
export function useLiveEvent(event, handler) {
  const { subscribe } = useLive();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe(event, (payload) => ref.current(payload)), [event, subscribe]);
}

export function LiveProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestUnreadMessage, setLatestUnreadMessage] = useState(null);
  const [banner, setBanner] = useState(null);
  const socketRef = useRef(null);
  const listeners = useRef(new Map());

  const dispatch = useCallback((event, payload) => {
    (listeners.current.get(event) || []).forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.log(`Live handler for ${event} failed:`, e?.message);
      }
    });
  }, []);

  const subscribe = useCallback((event, fn) => {
    const set = listeners.current.get(event) || new Set();
    set.add(fn);
    listeners.current.set(event, set);
    return () => set.delete(fn);
  }, []);

  // ---- Concierge unread messages -------------------------------------------------------------
  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await apiClient.get('/wellness/concierge/messages?limit=50');
      const messages = response.messages || [];
      const lastRead = Number(await AsyncStorage.getItem(LAST_READ)) || 0;
      const unread = messages.filter((m) => m.sender_type === 'concierge' && Number(m.id) > lastRead);
      setUnreadCount(unread.length);
      setLatestUnreadMessage(unread[unread.length - 1] || null);
    } catch {
      // keep the last known count
    }
  }, [isAuthenticated]);

  const markAsRead = useCallback(async (messageId) => {
    setUnreadCount(0);
    setLatestUnreadMessage(null);
    if (messageId) await AsyncStorage.setItem(LAST_READ, String(messageId));
  }, []);

  const markAllAsRead = useCallback(async () => {
    setUnreadCount(0);
    setLatestUnreadMessage(null);
    try {
      const response = await apiClient.get('/wellness/concierge/messages?limit=50');
      const last = (response.messages || []).slice(-1)[0];
      if (last) await AsyncStorage.setItem(LAST_READ, String(last.id));
    } catch {
      // cleared on screen anyway
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) refreshUnreadCount();
    else {
      setUnreadCount(0);
      setLatestUnreadMessage(null);
    }
  }, [isAuthenticated, refreshUnreadCount]);

  // ---- Socket --------------------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined;
    let socket;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled || !token) return;
      socket = io(SERVER_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 15000,
      });
      socketRef.current = socket;
      socket.on('connect', () => {
        setConnected(true);
        socket.emit('join', user.id);
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on('new_message', (message) => {
        if (message?.sender_type === 'concierge') {
          setUnreadCount((n) => n + 1);
          setLatestUnreadMessage(message);
        }
        dispatch('new_message', message);
      });
      BANNER_EVENTS.forEach((event) =>
        socket.on(event, (payload = {}) => {
          dispatch(event, payload);
          const here = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null;
          if (payload.screen && payload.screen === here) return; // already looking at it
          setBanner({ id: Date.now(), title: payload.title || 'Faysha', body: payload.body || '', screen: payload.screen });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }),
      );
    })();
    return () => {
      cancelled = true;
      setConnected(false);
      if (socket) socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.id, dispatch]);

  // ---- Push notifications ----------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated) return;
    AsyncStorage.getItem('faysha.pushEnabled').then((pref) => {
      if (pref !== 'off') registerForPush();
    });
  }, [isAuthenticated]);

  useEffect(
    () =>
      onNotificationOpened((data) => {
        // Wait for the navigator on a cold start.
        const go = (tries = 0) => {
          if (navigationRef.isReady()) openScreen(data.screen || 'Home');
          else if (tries < 20) setTimeout(() => go(tries + 1), 250);
        };
        go();
      }),
    [],
  );

  const value = useMemo(
    () => ({ connected, subscribe, unreadCount, latestUnreadMessage, refreshUnreadCount, markAsRead, markAllAsRead, showBanner: setBanner }),
    [connected, subscribe, unreadCount, latestUnreadMessage, refreshUnreadCount, markAsRead, markAllAsRead],
  );

  return (
    <LiveContext.Provider value={value}>
      {children}
      <Banner banner={banner} onDone={() => setBanner(null)} />
    </LiveContext.Provider>
  );
}

function Banner({ banner, onDone }) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    if (!banner) return undefined;
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 9 }).start();
    const t = setTimeout(() => Animated.timing(y, { toValue: -160, duration: 250, useNativeDriver: true }).start(onDone), 4500);
    return () => clearTimeout(t);
  }, [banner, y, onDone]);

  if (!banner) return null;
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + 6, transform: [{ translateY: y }] }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onDone();
          if (banner.screen) openScreen(banner.screen);
        }}
        style={styles.banner}
      >
        <View style={styles.dot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{banner.title}</Text>
          {!!banner.body && <Text style={styles.body} numberOfLines={2}>{banner.body}</Text>}
        </View>
        {banner.screen ? <Text style={styles.chev}>›</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, zIndex: 1000, elevation: 20 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1b1813',
    borderColor: COLORS.borderGold,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  title: { color: COLORS.primary, fontFamily: FONTS.heading, fontSize: 13, letterSpacing: 0.6 },
  body: { color: COLORS.text, fontFamily: FONTS.body, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  chev: { color: COLORS.primary, fontSize: 22 },
});

export default LiveContext;
