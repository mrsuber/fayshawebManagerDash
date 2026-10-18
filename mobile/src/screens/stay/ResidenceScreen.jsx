import React from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button, Pill, Loading, ErrorView, Notice, SectionTitle, Eyebrow, Heading, Body } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import guest from '../../services/guestService';
import useLoad from '../../hooks/useLoad';
import { useLiveEvent } from '../../contexts/LiveContext';
import { fileUrl } from '../../config';
import { stayRange, xaf } from '../../utils/format';

const STATUS = { checked_in: 'In residence', confirmed: 'Confirmed', pending: 'Awaiting payment' };

/** Quick requests: one tap opens the request form already filled in. */
const QUICK = [
  { icon: 'sparkles-outline', label: 'Clean my residence', department: 'Housekeeping', title: 'Please clean the residence' },
  { icon: 'water-outline', label: 'Fresh towels', department: 'Housekeeping', title: 'Fresh towels, please' },
  { icon: 'construct-outline', label: 'Something needs fixing', department: 'Maintenance', title: '' },
  { icon: 'car-outline', label: 'Book a ride', screen: 'Transfers' },
];

/** The Residence tab: everything about the current stay and the services around it. */
export default function ResidenceScreen({ navigation }) {
  const { data, loading, error, refreshing, refresh, reload } = useLoad(() => guest.overview());
  useLiveEvent('stay:confirmed', reload);
  useLiveEvent('request:updated', reload);
  useLiveEvent('dining:updated', reload);

  const stay = data?.stay;

  if (loading) return <Screen title="Residence"><Loading /></Screen>;
  if (error && !data) return <Screen title="Residence"><ErrorView message={error} onRetry={reload} /></Screen>;

  if (!stay) {
    return (
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <Eyebrow style={{ marginTop: 18 }}>Your residence</Eyebrow>
        <Heading size={26}>A private residence, waiting for you</Heading>
        <Body style={{ marginTop: 10 }}>
          Book a stay and this is where you'll find your digital key, your smart home, in-residence dining, housekeeping and rides.
        </Body>
        <Button title="Book a stay" icon="calendar-outline" onPress={() => navigation.navigate('BookStay')} style={{ marginTop: 24 }} />
        <Button title="My stays" variant="ghost" onPress={() => navigation.navigate('MyStays')} style={{ marginTop: 12 }} />
        <SectionTitle>DISCOVER</SectionTitle>
        <Tile icon="compass-outline" title="Explore the estate" text="A 360° tour of the residences and grounds" onPress={() => navigation.navigate('Explore')} />
        <Tile icon="leaf-outline" title="Wellness" text="Spa, movement and reflection rituals" onPress={() => navigation.navigate('Main', { screen: 'Wellness' })} />
      </Screen>
    );
  }

  const inHouse = stay.status === 'checked_in';
  const services = [
    { icon: 'notifications-outline', title: 'Requests', text: 'Housekeeping, repairs and more', screen: 'Requests', count: data.openRequests },
    { icon: 'restaurant-outline', title: 'Dining', text: inHouse ? 'Order in or book a table' : 'Book a table', screen: 'Dining', count: data.activeOrders },
    { icon: 'sparkles-outline', title: 'Experiences', text: 'Excursions and rituals', screen: 'Experiences' },
    { icon: 'car-outline', title: 'Rides', text: 'Airport and city rides', screen: 'Transfers' },
    { icon: 'receipt-outline', title: 'My bill', text: stay.balance > 0 ? `${xaf(stay.balance)} to settle` : 'All settled', screen: 'Bill' },
    { icon: 'compass-outline', title: 'Explore', text: 'The estate in 360°', screen: 'Explore' },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('StayDetail', { id: stay.id })} style={{ marginTop: 14 }}>
        <ImageBackground
          source={stay.residence.image ? { uri: fileUrl(stay.residence.image) } : require('../../../assets/explore.jpg')}
          style={s.hero}
          imageStyle={{ borderRadius: 18 }}
        >
          <LinearGradient colors={['rgba(13,13,13,0.1)', 'rgba(13,13,13,0.92)']} style={s.heroShade}>
            <Pill label={STATUS[stay.status] || stay.status} tone={inHouse ? 'green' : stay.status === 'pending' ? 'gold' : 'blue'} />
            <View>
              <Text style={s.heroName}>{stay.residence.name}</Text>
              <Text style={s.heroMeta}>
                Residence {stay.residence.unit}
                {stay.residence.floor ? ` · Floor ${stay.residence.floor}` : ''} · {stayRange(stay.checkIn, stay.checkOut)}
              </Text>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>

      {stay.awaitingMobileMoney ? (
        <Notice style={{ marginTop: 14 }} icon="phone-portrait-outline">
          We're waiting for your mobile money payment. As soon as it arrives your stay is confirmed and your digital key is sent.
        </Notice>
      ) : stay.status === 'pending' ? (
        <Notice style={{ marginTop: 14 }}>This booking is held for you until payment is complete.</Notice>
      ) : null}

      <View style={s.actions}>
        <Action icon="key-outline" label="Digital key" onPress={() => navigation.navigate('DigitalKey')} disabled={stay.status === 'pending'} />
        <Action icon="home-outline" label="Smart home" onPress={() => navigation.navigate('SmartHome')} disabled={!inHouse} />
        <Action icon="chatbubble-ellipses-outline" label="Concierge" onPress={() => navigation.navigate('Main', { screen: 'Concierge' })} />
      </View>
      {!inHouse && stay.status !== 'pending' ? (
        <Body muted style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>Your smart home opens when you check in.</Body>
      ) : null}

      {stay.status !== 'pending' && (
        <>
          <SectionTitle>IN A TAP</SectionTitle>
          <View style={s.quickWrap}>
            {QUICK.map((q) => (
              <TouchableOpacity
                key={q.label}
                style={s.quick}
                activeOpacity={0.85}
                onPress={() => (q.screen ? navigation.navigate(q.screen) : navigation.navigate('Requests', { preset: { department: q.department, title: q.title } }))}
              >
                <Ionicons name={q.icon} size={16} color={COLORS.primary} />
                <Text style={s.quickText}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <SectionTitle>SERVICES</SectionTitle>
      <View style={s.grid}>
        {services.map((svc) => (
          <TouchableOpacity key={svc.title} style={s.gridItem} activeOpacity={0.85} onPress={() => navigation.navigate(svc.screen)}>
            <Card style={s.serviceCard}>
              <View style={s.serviceTop}>
                <View style={s.serviceIcon}>
                  <Ionicons name={svc.icon} size={19} color={COLORS.primary} />
                </View>
                {svc.count ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{svc.count}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={s.serviceTitle}>{svc.title}</Text>
              <Text style={s.serviceText} numberOfLines={3}>{svc.text}</Text>
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      <Card onPress={() => navigation.navigate('Rewards')} style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Ionicons name="diamond-outline" size={22} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.serviceTitle}>{data.tier} member</Text>
          <Text style={s.serviceText}>{data.points.toLocaleString()} points</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
      </Card>
    </Screen>
  );
}

function Action({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity style={[s.action, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} activeOpacity={0.85} accessibilityRole="button">
      <LinearGradient colors={['rgba(200,164,93,0.28)', 'rgba(200,164,93,0.1)']} style={s.actionIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </LinearGradient>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Tile({ icon, title, text, onPress }) {
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 }}>
      <View style={s.serviceIcon}>
        <Ionicons name={icon} size={19} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.serviceTitle}>{title}</Text>
        <Text style={s.serviceText}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
    </Card>
  );
}

const s = StyleSheet.create({
  hero: { height: 210, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderLight },
  heroShade: { flex: 1, padding: 18, justifyContent: 'space-between', borderRadius: 18 },
  heroName: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 24, letterSpacing: 0.8 },
  heroMeta: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 12.5, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  action: { flex: 1, alignItems: 'center', gap: 8 },
  actionIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderGold },
  actionLabel: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 12 },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: 'rgba(200,164,93,0.05)' },
  quickText: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 12.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  gridItem: { width: '50%', padding: 5 },
  serviceCard: { minHeight: 132 },
  serviceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  serviceIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(200,164,93,0.12)', alignItems: 'center', justifyContent: 'center' },
  serviceTitle: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 14.5, letterSpacing: 0.5 },
  serviceText: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: COLORS.background, fontSize: 11, fontWeight: '700' },
});
