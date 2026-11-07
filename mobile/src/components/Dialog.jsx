import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../constants/theme';
import { Button } from './ui';

/**
 * The app's own dialog in place of the system Alert: the same call, in the Faysha look.
 *   showAlert('Sign out?', 'You can sign back in at any time.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress }])
 * One <DialogHost /> is mounted at the root (App.js). Calls made before it mounts fall back to nothing being lost:
 * they queue and show once it is there.
 */
let host = null;
const queue = [];

export function showAlert(title, message, buttons, options = {}) {
  const dialog = { title: String(title || ''), message: message ? String(message) : '', buttons: buttons?.length ? buttons : [{ text: 'OK' }], ...options };
  if (host) host(dialog);
  else queue.push(dialog);
}

/** Picks a fitting icon and tone when the caller does not name one. */
function lookOf(d) {
  if (d.icon) return { icon: d.icon, tone: d.tone || 'gold' };
  const t = `${d.title} ${d.message}`.toLowerCase();
  if (/(sign out|log out|logout)/.test(t)) return { icon: 'log-out-outline', tone: 'gold' };
  if (d.buttons.some((b) => b.style === 'destructive')) return { icon: 'alert-circle-outline', tone: 'red' };
  if (/(error|could not|couldn|failed|invalid|not available|try again|sorry|unable)/.test(t)) return { icon: 'close-circle-outline', tone: 'red' };
  if (/(success|done|sent|saved|confirmed|thank|booked|received|updated|welcome|on its way|requested)/.test(t)) return { icon: 'checkmark-circle-outline', tone: 'green' };
  return { icon: 'sparkles-outline', tone: 'gold' };
}

const TONES = { gold: [COLORS.primary, 'rgba(200,164,93,0.12)'], red: ['#ff8a80', 'rgba(255,107,107,0.12)'], green: ['#7fd6a0', 'rgba(127,174,138,0.14)'] };

export function DialogHost() {
  const [current, setCurrent] = useState(null);
  const pending = useRef([]);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    host = (d) => {
      pending.current.push(d);
      setCurrent((c) => c || pending.current.shift());
    };
    while (queue.length) host(queue.shift());
    return () => {
      host = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    fade.setValue(0);
    Animated.spring(fade, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }).start();
    const { tone } = lookOf(current);
    if (tone === 'red') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    else if (tone === 'green') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [current, fade]);

  const close = (button) => {
    setCurrent(pending.current.shift() || null);
    // Run the action after the dialog has gone, so a follow-up dialog or navigation is not swallowed.
    if (button?.onPress) setTimeout(() => button.onPress(), 120);
  };

  if (!current) return null;
  const { icon, tone } = lookOf(current);
  const [fg, bg] = TONES[tone];
  const cancel = current.buttons.find((b) => b.style === 'cancel');
  const cancelable = current.cancelable !== false && (cancel || current.buttons.length === 1);
  // Main action last (at the bottom, under the thumb); cancel above it as a quiet button.
  const ordered = [...current.buttons.filter((b) => b.style === 'cancel'), ...current.buttons.filter((b) => b.style !== 'cancel')];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => cancelable && close(cancel)}>
      <Pressable style={st.backdrop} onPress={() => cancelable && close(cancel)} accessibilityLabel="Close" />
      <View style={st.center} pointerEvents="box-none">
        <Animated.View
          accessibilityRole="alert"
          style={[st.card, { opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}
        >
          <View style={[st.badge, { backgroundColor: bg, borderColor: fg + '55' }]}>
            <Ionicons name={icon} size={26} color={fg} />
          </View>
          {!!current.title && <Text style={st.title}>{current.title}</Text>}
          {!!current.message && <Text style={st.message}>{current.message}</Text>}
          <View style={[st.actions, ordered.length === 2 && st.actionsRow]}>
            {ordered.map((b, i) => (
              <Button
                key={`${b.text}-${i}`}
                title={b.text || 'OK'}
                small
                variant={b.style === 'cancel' ? 'ghost' : b.style === 'destructive' ? 'danger' : 'gold'}
                onPress={() => close(b)}
                style={ordered.length === 2 ? { flex: 1 } : undefined}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,5,0.72)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  badge: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontFamily: FONTS.heading, fontSize: 21, color: COLORS.text, textAlign: 'center', letterSpacing: 0.4, marginBottom: 8 },
  message: { fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 6 },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 16 },
  actionsRow: { flexDirection: 'row' },
});
