import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Screen, Card, Button, Pill, Loading, ErrorView, Empty, SectionTitle, Sheet, Field, ChipRow, Notice, Body, PickerField, Stepper } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { WELLNESS_IMAGES } from '../../constants/images';
import guest from '../../services/guestService';
import { errorMessage } from '../../services/api';
import useLoad from '../../hooks/useLoad';
import { fileUrl } from '../../config';
import { addDays, dayLabel, hhmm, isoDay, xaf } from '../../utils/format';

const fallbackImage = (category = '') => {
  const c = category.toLowerCase();
  if (/(spa|wellness|massage)/.test(c)) return WELLNESS_IMAGES.spa;
  if (/(fitness|sport|yoga)/.test(c)) return WELLNESS_IMAGES.gym;
  if (/(food|dining|culinary|cook)/.test(c)) return WELLNESS_IMAGES.dining;
  if (/(sunset|culture|ceremony)/.test(c)) return WELLNESS_IMAGES.sunset;
  return WELLNESS_IMAGES.explore;
};

/** Experiences curated by the property (FAY OS → Experiences). Booking adds the price to the stay's bill. */
export default function ExperiencesScreen({ navigation }) {
  const { data, setData, loading, error, refreshing, refresh, reload } = useLoad(async () => {
    const [list, bookings, overview] = await Promise.all([guest.experiences(), guest.experienceBookings(), guest.overview()]);
    return { list, bookings, stay: overview.stay };
  });
  const [category, setCategory] = useState('All');
  const [booking, setBooking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const list = data?.list || [];
  const categories = useMemo(() => ['All', ...Array.from(new Set(list.map((e) => e.category).filter(Boolean)))], [list]);
  const shown = category === 'All' ? list : list.filter((e) => e.category === category);
  const canBook = ['checked_in', 'confirmed'].includes(data?.stay?.status);

  const open = (experience) => {
    const time = new Date();
    time.setHours(10, 0, 0, 0);
    setFormError('');
    setBooking({ experience, date: addDays(new Date(), 1), time, guests: 1, notes: '' });
  };

  const book = async () => {
    setBusy(true);
    setFormError('');
    try {
      const b = await guest.bookExperience(booking.experience.id, { date: isoDay(booking.date), time: hhmm(booking.time), guests: booking.guests, notes: booking.notes.trim() || undefined });
      setData((d) => ({ ...d, bookings: [b, ...d.bookings] }));
      setBooking(null);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Experiences" subtitle="Curated by your hosts" onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh}>
      {loading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : (
        <>
          {!canBook ? <Notice style={{ marginTop: 12 }}>You can book experiences once your stay is confirmed.</Notice> : null}
          {data.bookings.length ? (
            <>
              <SectionTitle>YOUR PLANS</SectionTitle>
              {data.bookings.map((b) => (
                <Card key={b.id} style={{ marginBottom: 10 }}>
                  <View style={s.rowBetween}>
                    <Text style={s.title}>{b.experience}</Text>
                    <Pill label={b.status === 'pending' ? 'Requested' : b.status} />
                  </View>
                  <Text style={s.meta}>{dayLabel(b.date, { weekday: true })} · {b.time} · {b.guests} guest{b.guests > 1 ? 's' : ''}{b.total ? ` · ${xaf(b.total)}` : ''}</Text>
                </Card>
              ))}
            </>
          ) : null}
          {categories.length > 2 ? (
            <View style={{ marginTop: 18 }}>
              <ChipRow options={categories} value={category} onChange={setCategory} />
            </View>
          ) : null}
          <SectionTitle>DISCOVER</SectionTitle>
          {!list.length ? <Empty icon="sparkles-outline" title="New experiences are coming" text="Ask the concierge what's on during your stay." /> : null}
          {shown.map((e) => (
            <Card key={e.id} padded={false} style={{ marginBottom: 14 }}>
              <Image source={e.image ? { uri: fileUrl(e.image) } : fallbackImage(e.category)} style={s.image} />
              <View style={{ padding: 16 }}>
                {!!e.category && <Text style={s.eyebrow}>{e.category}</Text>}
                <Text style={s.title}>{e.name}</Text>
                {!!e.description && <Body muted style={{ marginTop: 6 }} numberOfLines={4}>{e.description}</Body>}
                <View style={[s.rowBetween, { marginTop: 14 }]}>
                  <Text style={s.meta}>{[e.duration, e.capacity ? `up to ${e.capacity}` : null].filter(Boolean).join(' · ')}</Text>
                  <Text style={s.price}>{e.price ? `${xaf(e.price)} / guest` : 'Complimentary'}</Text>
                </View>
                <Button title="Book" small onPress={() => open(e)} disabled={!canBook} style={{ marginTop: 14 }} />
              </View>
            </Card>
          ))}
        </>
      )}

      <Sheet visible={Boolean(booking)} onClose={() => setBooking(null)} title={booking?.experience.name}>
        {booking && (
          <>
            <PickerField label="Date" value={booking.date} minimumDate={new Date()} maximumDate={addDays(new Date(), 180)} onChange={(date) => setBooking({ ...booking, date })} />
            <PickerField label="Start time" mode="time" value={booking.time} onChange={(time) => setBooking({ ...booking, time })} />
            <Stepper label="Guests" value={booking.guests} min={1} max={booking.experience.capacity || 20} onChange={(guests) => setBooking({ ...booking, guests })} />
            <Field label="Anything we should know?" value={booking.notes} onChangeText={(notes) => setBooking({ ...booking, notes })} multiline maxLength={300} />
            {booking.experience.price ? (
              <Body style={{ marginBottom: 12 }}>
                {xaf(booking.experience.price * booking.guests)} will be added to your bill.
              </Body>
            ) : null}
            {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{formError}</Notice> : null}
            <Button title="Confirm booking" onPress={book} loading={busy} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  image: { width: '100%', height: 170 },
  eyebrow: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 16, letterSpacing: 0.5, flexShrink: 1 },
  meta: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 6 },
  price: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
});
