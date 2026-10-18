import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Loading, ErrorView, SectionTitle, Body, Empty } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import guest from '../../services/guestService';
import useLoad from '../../hooks/useLoad';
import { dayLabel } from '../../utils/format';

/** Faysha Circle: points from completed stays and services (1 point per 1,000 XAF), four tiers with perks. */
export default function RewardsScreen({ navigation }) {
  const { data, loading, error, refreshing, refresh, reload } = useLoad(() => guest.rewards());

  if (loading) return <Screen title="Faysha Circle" onBack={() => navigation.goBack()}><Loading /></Screen>;
  if (error && !data) return <Screen title="Faysha Circle" onBack={() => navigation.goBack()}><ErrorView message={error} onRetry={reload} /></Screen>;

  const { points, tier, next, tiers, history } = data;
  const progress = next ? Math.min(1, (points - tier.from) / (next.at - tier.from)) : 1;

  return (
    <Screen title="Faysha Circle" subtitle="Rewards for every stay" onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh}>
      <LinearGradient colors={['#2a2216', '#15120d']} style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.brand}>FAYSHA</Text>
          <Ionicons name="diamond-outline" size={20} color={COLORS.primary} />
        </View>
        <Text style={s.tier}>{tier.name}</Text>
        <Text style={s.points}>{points.toLocaleString()} points</Text>
        <View style={s.track}>
          <View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={s.next}>{next ? `${next.toGo.toLocaleString()} points to ${next.name}` : 'You hold our highest tier'}</Text>
      </LinearGradient>

      <SectionTitle>YOUR PERKS</SectionTitle>
      <Card>
        {tiers
          .filter((t) => t.from <= tier.from)
          .flatMap((t) => t.perks)
          .map((perk) => (
            <View key={perk} style={s.perk}>
              <Ionicons name="checkmark-circle" size={17} color={COLORS.primary} />
              <Text style={s.perkText}>{perk}</Text>
            </View>
          ))}
      </Card>

      <SectionTitle>TIERS</SectionTitle>
      {tiers.map((t) => {
        const current = t.name === tier.name;
        const reached = points >= t.from;
        return (
          <Card key={t.name} highlight={current} style={{ marginBottom: 10 }}>
            <View style={s.tierRow}>
              <Text style={[s.tierName, !reached && { color: COLORS.textTertiary }]}>{t.name}</Text>
              <Text style={s.tierFrom}>{t.from ? `${t.from.toLocaleString()} pts` : 'Welcome'}</Text>
            </View>
            {t.perks.map((p) => (
              <Body key={p} muted={!reached} style={{ fontSize: 12.5, marginTop: 4 }}>· {p}</Body>
            ))}
          </Card>
        );
      })}

      <SectionTitle>HISTORY</SectionTitle>
      {!history.length ? (
        <Empty icon="sparkles-outline" title="Your first points are waiting" text="You earn 1 point for every 1,000 XAF spent on stays, dining and experiences, added after check-out." />
      ) : (
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {history.map((h, i) => (
            <View key={h.id} style={[s.hist, i < history.length - 1 && s.border]}>
              <View style={{ flex: 1 }}>
                <Text style={s.perkText}>{h.label}</Text>
                <Text style={s.tierFrom}>{dayLabel(h.date)}</Text>
              </View>
              <Text style={s.earned}>+{h.points}</Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { marginTop: 16, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: COLORS.borderGold },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: FONTS.heading, color: COLORS.primary, letterSpacing: 6, fontSize: 13 },
  tier: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 30, marginTop: 26, letterSpacing: 1 },
  points: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(242,233,216,0.1)', marginTop: 20, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: COLORS.primary },
  next: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 8 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  perkText: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 13.5, flexShrink: 1 },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tierName: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 16, letterSpacing: 0.6 },
  tierFrom: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  hist: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  earned: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 14 },
});
