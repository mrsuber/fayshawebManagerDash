import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, ErrorView, Heading, Loading, Screen } from '../components/ui';
import { COLORS, FONTS } from '../constants/theme';
import useLoad from '../hooks/useLoad';
import apiClient from '../services/api';

const ICON = {
  'stay:confirmed': 'checkmark-circle-outline', 'stay:arrival': 'home-outline', 'stay:departure': 'airplane-outline', 'event:quote': 'sparkles-outline',
  'message:push': 'chatbubble-ellipses-outline', 'request:updated': 'notifications-outline', 'dining:updated': 'restaurant-outline', 'transfer:updated': 'car-outline',
};
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** Everything Faysha has told the guest: confirmations, proposals, reminders, replies. */
export default function NotificationsScreen({ navigation }) {
  const { data, loading, error, reload, refreshing, refresh } = useLoad(() => apiClient.get('/guest/notifications'));
  // Opening the inbox marks everything as read.
  useEffect(() => {
    if (data?.unread) apiClient.post('/guest/notifications/read', {}).catch(() => {});
  }, [data?.unread]);

  const open = (n) => {
    const screen = n.data?.screen;
    if (!screen) return;
    if (['Residence', 'Wellness', 'Concierge', 'Home', 'Profile'].includes(screen)) navigation.navigate('Main', { screen });
    else navigation.navigate(screen, n.data);
  };

  if (loading) return <Screen title="Notifications" onBack={() => navigation.goBack()}><Loading /></Screen>;
  if (error && !data) return <Screen title="Notifications" onBack={() => navigation.goBack()}><ErrorView message={error} onRetry={reload} /></Screen>;
  return (
    <Screen title="Notifications" onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh}>
      {!data?.items?.length ? (
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <Ionicons name="notifications-outline" size={40} color={COLORS.primary} />
          <Heading size={22} style={{ marginTop: 14 }}>All quiet</Heading>
          <Body muted style={{ textAlign: 'center', marginTop: 6 }}>Confirmations, replies from the concierge and reminders for your stay appear here.</Body>
        </View>
      ) : null}
      {(data?.items || []).map((n) => (
        <TouchableOpacity key={n.id} style={s.row} activeOpacity={n.data?.screen ? 0.7 : 1} onPress={() => open(n)}>
          <View style={[s.icon, !n.read && s.iconUnread]}>
            <Ionicons name={ICON[n.event] || 'notifications-outline'} size={19} color={n.read ? COLORS.textTertiary : COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.head}>
              <Text style={[s.title, !n.read && { color: COLORS.text }]} numberOfLines={2}>{n.title}</Text>
              <Text style={s.time}>{ago(n.createdAt)}</Text>
            </View>
            {n.body ? <Text style={s.body}>{n.body}</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  iconUnread: { borderColor: COLORS.primary, backgroundColor: 'rgba(200,164,93,0.12)' },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  time: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 11.5 },
  body: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
