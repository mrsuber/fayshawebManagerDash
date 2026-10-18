import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button, Pill, Loading, ErrorView, Empty, SectionTitle, Sheet, Field, ChipRow, Notice, PickerField } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import guest from '../../services/guestService';
import { errorMessage } from '../../services/api';
import useLoad from '../../hooks/useLoad';
import { useLiveEvent } from '../../contexts/LiveContext';
import { addDays, dayLabel, hhmm, isoDay, parseDay } from '../../utils/format';

const KINDS = [
  { value: 'Airport pickup', label: 'Airport pickup', icon: 'airplane-outline' },
  { value: 'Airport drop-off', label: 'Airport drop-off', icon: 'airplane-outline' },
  { value: 'City ride', label: 'City ride', icon: 'car-outline' },
];

/** Airport transfers and rides (FAY OS → Transportation). Driver and vehicle appear once assigned. */
export default function TransfersScreen({ navigation }) {
  const { data, setData, loading, error, refreshing, refresh, reload } = useLoad(async () => {
    const [rides, overview] = await Promise.all([guest.transfers(), guest.overview()]);
    return { rides, stay: overview.stay };
  });
  useLiveEvent('transfer:updated', reload);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const stay = data?.stay;
  const canBook = ['checked_in', 'confirmed'].includes(stay?.status);

  const open = (kind = 'Airport pickup') => {
    const arrival = stay && stay.status === 'confirmed' ? parseDay(stay.checkIn) : new Date();
    const departure = stay ? parseDay(stay.checkOut) : addDays(new Date(), 1);
    const date = kind === 'Airport drop-off' ? departure : kind === 'Airport pickup' ? arrival : new Date();
    const time = new Date();
    time.setHours(kind === 'Airport drop-off' ? 9 : 14, 0, 0, 0);
    setFormError('');
    setForm({ kind, date: date < new Date(new Date().toDateString()) ? new Date() : date, time, flight: '', place: '' });
  };

  const submit = async () => {
    setBusy(true);
    setFormError('');
    try {
      const body = { kind: form.kind, date: isoDay(form.date), time: hhmm(form.time), flight: form.flight.trim() || undefined };
      if (form.kind === 'City ride') body.to = form.place.trim() || undefined;
      const ride = await guest.requestTransfer(body);
      setData((d) => ({ ...d, rides: [ride, ...d.rides] }));
      setForm(null);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const today = isoDay(new Date());
  const rides = data?.rides || [];
  const upcoming = rides.filter((r) => r.date >= today && r.status !== 'Cancelled' && r.status !== 'Completed');
  const past = rides.filter((r) => !upcoming.includes(r));

  return (
    <Screen
      title="Rides"
      subtitle="Your Faysha driver, on time"
      onBack={() => navigation.goBack()}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={canBook ? <Button title="Book a ride" icon="car-outline" onPress={() => open()} /> : null}
    >
      {loading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : (
        <>
          {!canBook ? <Notice style={{ marginTop: 12 }}>Rides can be booked once your stay is confirmed.</Notice> : null}
          {!rides.length ? <Empty icon="car-outline" title="No rides booked" text="Book your airport pickup and we'll be waiting at arrivals with your name." /> : null}
          {upcoming.length ? <SectionTitle>UPCOMING</SectionTitle> : null}
          {upcoming.map((r) => <RideCard key={r.id} ride={r} />)}
          {past.length ? <SectionTitle>EARLIER</SectionTitle> : null}
          {past.map((r) => <RideCard key={r.id} ride={r} />)}
        </>
      )}

      <Sheet visible={Boolean(form)} onClose={() => setForm(null)} title="Book a ride">
        {form && (
          <>
            <ChipRow options={KINDS} value={form.kind} onChange={(kind) => setForm({ ...form, kind })} />
            <View style={{ height: 16 }} />
            <PickerField label="Date" value={form.date} minimumDate={new Date()} maximumDate={addDays(new Date(), 365)} onChange={(date) => setForm({ ...form, date })} />
            <PickerField label={form.kind === 'Airport pickup' ? 'Landing time' : 'Pickup time'} mode="time" value={form.time} onChange={(time) => setForm({ ...form, time })} />
            {form.kind !== 'City ride' ? (
              <Field label="Flight number (optional)" value={form.flight} onChangeText={(flight) => setForm({ ...form, flight })} placeholder="e.g. AF 900" autoCapitalize="characters" maxLength={12} hint="We follow your flight so the driver adjusts to delays." />
            ) : (
              <Field label="Where to?" value={form.place} onChangeText={(place) => setForm({ ...form, place })} placeholder="Address or place" maxLength={200} />
            )}
            {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{formError}</Notice> : null}
            <Button title="Request ride" onPress={submit} loading={busy} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function RideCard({ ride: r }) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={s.rowBetween}>
        <Text style={s.kind}>{r.kind}</Text>
        <Pill label={r.status} />
      </View>
      <Text style={s.when}>{dayLabel(r.date, { weekday: true })} · {r.time}</Text>
      <View style={s.route}>
        <Ionicons name="ellipse-outline" size={10} color={COLORS.primary} />
        <Text style={s.place} numberOfLines={1}>{r.from}</Text>
      </View>
      <View style={s.route}>
        <Ionicons name="location-outline" size={12} color={COLORS.primary} />
        <Text style={s.place} numberOfLines={1}>{r.to}</Text>
      </View>
      {r.driver || r.vehicle ? (
        <View style={s.driver}>
          <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} />
          <Text style={s.place}>{[r.driver, r.vehicle].filter(Boolean).join(' · ')}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  when: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 16, marginTop: 8, marginBottom: 8, letterSpacing: 0.4 },
  route: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  place: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 13, flexShrink: 1 },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
});
