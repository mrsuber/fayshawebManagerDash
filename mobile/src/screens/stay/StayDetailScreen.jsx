import React, { useState } from 'react';
import { Image, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Loading, ErrorView, Pill, Button, ListRow, Sheet, Field, Notice, Body, SectionTitle, tap } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import guest from '../../services/guestService';
import apiClient, { errorMessage } from '../../services/api';
import useLoad from '../../hooks/useLoad';
import { useAuth } from '../../contexts/AuthContext';
import { fileUrl } from '../../config';
import { dayLabel, xaf } from '../../utils/format';
import { STAY_STATUS } from './MyStaysScreen';

/** One stay: dates, residence, payment, key and bill; feedback once it is over. */
export default function StayDetailScreen({ navigation, route }) {
  const { user } = useAuth();
  const { data: stay, loading, error, refreshing, refresh, reload } = useLoad(() => guest.stay(route.params.id));
  const [feedback, setFeedback] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const sendFeedback = async () => {
    if (!feedback.rating) {
      setFormError('Choose a rating');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const form = new FormData();
      const text = feedback.text.trim();
      const fields = {
        name: user?.fullName || 'Guest',
        email: user?.email || '',
        feedbackType: text ? 'testimonial' : 'general',
        rating: String(feedback.rating),
        testimonialText: text,
        whatWentWell: text,
        areasForImprovement: feedback.improve.trim(),
        additionalComments: `Stay ${stay.number}`,
        allowPublicDisplay: String(feedback.share && Boolean(text)),
      };
      Object.entries(fields).forEach(([k, v]) => form.append(k, v));
      await apiClient.post('/feedback/submit', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSent(true);
      setFeedback(null);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen title="Stay" onBack={() => navigation.goBack()}><Loading /></Screen>;
  if (error && !stay) return <Screen title="Stay" onBack={() => navigation.goBack()}><ErrorView message={error} onRetry={reload} /></Screen>;

  const keyReady = ['confirmed', 'checked_in'].includes(stay.status);
  return (
    <Screen title={stay.residence.name} subtitle={stay.number} onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh}>
      <Image source={stay.residence.image ? { uri: fileUrl(stay.residence.image) } : require('../../../assets/explore.jpg')} style={s.image} />
      <View style={s.statusRow}>
        <Pill label={STAY_STATUS[stay.status] || stay.status} />
        <Text style={s.unit}>Residence {stay.residence.unit}{stay.residence.building ? ` · ${stay.residence.building}` : ''}</Text>
      </View>

      <Card style={{ marginTop: 14 }}>
        <View style={s.dates}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>CHECK-IN</Text>
            <Text style={s.date}>{dayLabel(stay.checkIn, { weekday: true })}</Text>
            <Text style={s.small}>from 14:00</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={s.label}>CHECK-OUT</Text>
            <Text style={s.date}>{dayLabel(stay.checkOut, { weekday: true })}</Text>
            <Text style={s.small}>until 11:00</Text>
          </View>
        </View>
        <Text style={[s.small, { textAlign: 'center', marginTop: 12 }]}>{stay.nights} night{stay.nights === 1 ? '' : 's'} · {stay.guests} guest{stay.guests === 1 ? '' : 's'}</Text>
      </Card>

      {stay.awaitingMobileMoney ? (
        <Notice style={{ marginTop: 12 }} icon="phone-portrait-outline">Waiting for your mobile money payment. We'll confirm your stay and send your key as soon as it arrives.</Notice>
      ) : null}

      <Card padded={false} style={{ marginTop: 14, paddingHorizontal: 16 }}>
        {keyReady ? <ListRow icon="key-outline" title="Digital key" subtitle="Gate code, door PIN and deposit box" onPress={() => navigation.navigate('DigitalKey')} /> : null}
        <ListRow icon="receipt-outline" title="Bill" subtitle={`${xaf(stay.total)} · ${stay.balance > 0 ? `${xaf(stay.balance)} to settle` : 'settled'}`} onPress={() => navigation.navigate('Bill', { stayId: stay.id })} />
        <ListRow icon="chatbubble-ellipses-outline" title="Talk to the concierge" subtitle="Changes, early arrival, special occasions" onPress={() => navigation.navigate('Main', { screen: 'Concierge' })} last />
      </Card>

      {stay.specialRequests ? (
        <>
          <SectionTitle>YOUR REQUESTS</SectionTitle>
          <Body>{stay.specialRequests}</Body>
        </>
      ) : null}

      {stay.status === 'checked_out' ? (
        sent ? (
          <Notice tone="green" icon="heart-outline" style={{ marginTop: 22 }}>Thank you — your words mean a great deal to the whole team.</Notice>
        ) : (
          <Button title="Share your experience" icon="star-outline" variant="ghost" onPress={() => { setFormError(''); setFeedback({ rating: 0, text: '', improve: '', share: true }); }} style={{ marginTop: 22 }} />
        )
      ) : null}

      <Sheet visible={Boolean(feedback)} onClose={() => setFeedback(null)} title="How was your stay?">
        {feedback && (
          <>
            <View style={s.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => { tap(); setFeedback({ ...feedback, rating: n }); }} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>
                  <Ionicons name={n <= feedback.rating ? 'star' : 'star-outline'} size={34} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
            </View>
            <Field label="What did you love?" value={feedback.text} onChangeText={(text) => setFeedback({ ...feedback, text })} multiline maxLength={1000} />
            <Field label="What could we do better?" value={feedback.improve} onChangeText={(improve) => setFeedback({ ...feedback, improve })} multiline maxLength={1000} />
            <View style={s.shareRow}>
              <Text style={[s.small, { flex: 1, fontSize: 13 }]}>Faysha may share my words on its website</Text>
              <Switch value={feedback.share} onValueChange={(share) => setFeedback({ ...feedback, share })} trackColor={{ true: COLORS.primary, false: 'rgba(242,233,216,0.15)' }} thumbColor={COLORS.text}
          activeThumbColor={COLORS.text} />
            </View>
            {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{formError}</Notice> : null}
            <Button title="Send" onPress={sendFeedback} loading={busy} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  image: { width: '100%', height: 200, borderRadius: 16, marginTop: 14, borderWidth: 1, borderColor: COLORS.borderLight },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  unit: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 12.5 },
  dates: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 10, letterSpacing: 1.8 },
  date: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 16, marginTop: 6, letterSpacing: 0.4 },
  small: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
});
