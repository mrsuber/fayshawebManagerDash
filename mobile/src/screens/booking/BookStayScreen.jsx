import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import { Screen, Card, Button, Field, PickerField, Stepper, Notice, Checkbox, ChipRow, Heading, Body, Eyebrow, SectionTitle, Loading } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import apiClient, { errorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { fileUrl, STRIPE_PUBLISHABLE_KEY } from '../../config';
import { addDays, dayLabel, isoDay, nightsBetween, xaf } from '../../utils/format';

const STEPS = ['Dates', 'Residence', 'Details', 'Terms', 'Payment'];
const METHODS = [
  { value: 'card', label: 'Card', icon: 'card-outline' },
  { value: 'mtn', label: 'MTN MoMo', icon: 'phone-portrait-outline' },
  { value: 'orange', label: 'Orange Money', icon: 'phone-portrait-outline' },
];

/**
 * Booking a stay, the same flow as the website (/book): dates and guests → residence → guest details →
 * terms of stay → payment by card (Stripe) or MTN / Orange mobile money → confirmation.
 * Works signed in (the booking joins the guest's account) or as a new guest (an account is created with the booking).
 */
export default function BookStayScreen({ navigation }) {
  const { user, isAuthenticated } = useAuth();
  const stripe = useStripe();
  const [step, setStep] = useState(0);
  const [stay, setStay] = useState({ checkIn: addDays(new Date(), 1), checkOut: addDays(new Date(), 3), guests: 2 });
  const [options, setOptions] = useState(null);
  const [choice, setChoice] = useState(null);
  const [details, setDetails] = useState({ name: user?.fullName || '', email: user?.email || '', phone: user?.phone || '', requests: '' });
  const [terms, setTerms] = useState({ terms: false, rules: false });
  const [method, setMethod] = useState('card');
  const [momoPhone, setMomoPhone] = useState(user?.phone || '');
  const [cardComplete, setCardComplete] = useState(false);
  const [booking, setBooking] = useState(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const total = choice ? choice.price * nights : 0;

  const back = () => {
    setError('');
    if (step === 0 || result) navigation.goBack();
    else setStep(step - 1);
  };

  const search = async () => {
    if (nights < 1) {
      setError('Check-out must be after check-in');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [avail, cats] = await Promise.all([
        apiClient.get('/bookings/availability', { params: { start_date: isoDay(stay.checkIn), end_date: isoDay(stay.checkOut) } }),
        apiClient.get('/apartments/categories', { params: { active_only: 'true' } }).catch(() => ({ categories: [] })),
      ]);
      const byCat = new Map();
      (avail.availability || []).forEach((u) => {
        const id = u.category_id;
        const cat = (cats.categories || []).find((c) => c.id === id) || {};
        const entry = byCat.get(id) || {
          categoryId: id,
          name: u.category_display_name || cat.display_name || 'Residence',
          description: u.category_description || cat.description || '',
          image: cat.primary_image || cat.representative_image || u.primary_image || null,
          maxGuests: Number(cat.max_guests) || Number(u.max_guests) || 0,
          bedrooms: Number(cat.bedrooms) || 0,
          units: [],
        };
        entry.units.push({ id: u.id, unit: u.unit_number, price: Number(u.price_per_night) || 0, available: u.is_available !== false, maxGuests: Number(u.max_guests) || entry.maxGuests });
        byCat.set(id, entry);
      });
      const list = Array.from(byCat.values()).map((c) => {
        const fits = c.units.filter((u) => u.available && (!u.maxGuests || u.maxGuests >= stay.guests)).sort((a, b) => a.price - b.price);
        return { ...c, unit: fits[0] || null, price: fits[0]?.price || Math.min(...c.units.map((u) => u.price)) };
      });
      list.sort((a, b) => Boolean(b.unit) - Boolean(a.unit) || a.price - b.price);
      setOptions(list);
      setChoice(null);
      setBooking(null);
      setStep(1);
    } catch (e) {
      setError(errorMessage(e, 'Could not check availability'));
    } finally {
      setBusy(false);
    }
  };

  const toTerms = () => {
    const { name, email, phone } = details;
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError('Please fill in your name, email and phone');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    if (!momoPhone) setMomoPhone(phone);
    setError('');
    setStep(3);
  };

  /** The booking is created once and reused if a payment attempt fails. */
  const ensureBooking = async () => {
    if (booking) return booking;
    const check = await apiClient.post('/bookings/check-availability', { apartment_id: choice.unit.id, check_in_date: isoDay(stay.checkIn), check_out_date: isoDay(stay.checkOut) });
    if (!check.available) throw new Error('That residence was just booked for these dates. Please choose another.');
    const created = await apiClient.post('/bookings', {
      apartment_id: choice.unit.id,
      check_in_date: isoDay(stay.checkIn),
      check_out_date: isoDay(stay.checkOut),
      number_of_guests: stay.guests,
      guest_name: details.name.trim(),
      guest_email: details.email.trim().toLowerCase(),
      guest_phone: details.phone.trim(),
      special_requests: details.requests.trim() || null,
    });
    setBooking(created.booking);
    setAccountCreated(Boolean(created.accountCreated));
    return created.booking;
  };

  const pay = async () => {
    setBusy(true);
    setError('');
    const acceptedAt = new Date().toISOString();
    try {
      if (method === 'card') {
        if (!STRIPE_PUBLISHABLE_KEY) throw new Error('Card payments are not available in this version of the app. Please choose mobile money.');
        if (!cardComplete) throw new Error('Please complete your card details');
      } else if (!momoPhone.trim()) {
        throw new Error('Enter the mobile money number to charge');
      }
      const b = await ensureBooking();
      if (method === 'card') {
        const intent = await apiClient.post('/payments/create-intent', { booking_id: b.id });
        const { error: stripeError } = await stripe.confirmPayment(intent.client_secret, {
          paymentMethodType: 'Card',
          paymentMethodData: { billingDetails: { name: details.name.trim(), email: details.email.trim(), phone: details.phone.trim() } },
        });
        if (stripeError) throw new Error(stripeError.message);
        await apiClient.post(`/bookings/${b.id}/confirm`, {
          payment_intent_id: intent.payment?.stripe_payment_intent_id,
          terms_accepted: true,
          terms_accepted_at: acceptedAt,
        });
        setResult('confirmed');
      } else {
        await apiClient.post('/payments/mobile-money', { booking_id: b.id, provider: method, phone: momoPhone.trim(), terms_accepted: true, terms_accepted_at: acceptedAt, source: 'app' });
        setResult('pending');
      }
    } catch (e) {
      setError(errorMessage(e, 'The payment did not go through. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // ---------- Confirmation ----------
  if (result) {
    const confirmed = result === 'confirmed';
    return (
      <Screen>
        <View style={s.done}>
          <View style={s.doneIcon}>
            <Ionicons name={confirmed ? 'checkmark' : 'time-outline'} size={34} color={COLORS.background} />
          </View>
          <Eyebrow style={{ textAlign: 'center', marginTop: 22 }}>{booking?.booking_number}</Eyebrow>
          <Heading size={26} style={{ textAlign: 'center' }}>{confirmed ? 'Your stay is confirmed' : 'Almost there'}</Heading>
          <Body style={{ textAlign: 'center', marginTop: 12 }}>
            {confirmed
              ? `We look forward to welcoming you on ${dayLabel(stay.checkIn, { weekday: true })}. Your confirmation and digital key are on their way to ${details.email.trim()}.`
              : `Approve the ${method === 'mtn' ? 'MTN Mobile Money' : 'Orange Money'} payment of ${xaf(total)} on ${momoPhone}. As soon as it arrives, we confirm your stay and send your digital key to ${details.email.trim()}.`}
          </Body>
          {!isAuthenticated ? (
            <Notice style={{ marginTop: 20 }} icon="person-circle-outline">
              {accountCreated
                ? `We've created your Faysha account with ${details.email.trim()}. Your sign-in details arrive by email with your confirmation — sign in to see your stay, your key and every service.`
                : `Sign in with your Faysha account (${details.email.trim()}) to see this stay, your key and every service.`}
            </Notice>
          ) : null}
        </View>
        {isAuthenticated ? (
          <Button title="Go to my residence" onPress={() => navigation.navigate('Main', { screen: 'Residence' })} style={{ marginTop: 28 }} />
        ) : (
          <Button title="Sign in" onPress={() => navigation.navigate('Login', { email: details.email.trim() })} style={{ marginTop: 28 }} />
        )}
        <Button title="Done" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
      </Screen>
    );
  }

  // ---------- Steps ----------
  let body;
  let footer;
  if (step === 0) {
    body = (
      <>
        <Heading size={24} style={{ marginTop: 6 }}>When would you like to stay?</Heading>
        <Body muted style={{ marginTop: 6, marginBottom: 20 }}>Check-in from 14:00 · check-out until 11:00</Body>
        <PickerField
          label="Check-in"
          value={stay.checkIn}
          minimumDate={new Date()}
          onChange={(checkIn) => setStay({ ...stay, checkIn, checkOut: stay.checkOut <= checkIn ? addDays(checkIn, 1) : stay.checkOut })}
        />
        <PickerField label="Check-out" value={stay.checkOut} minimumDate={addDays(stay.checkIn, 1)} onChange={(checkOut) => setStay({ ...stay, checkOut })} />
        <Stepper label="Guests" value={stay.guests} min={1} max={12} onChange={(guests) => setStay({ ...stay, guests })} />
        {nights > 0 ? <Text style={s.nights}>{nights} night{nights > 1 ? 's' : ''}</Text> : null}
      </>
    );
    footer = <Button title="See available residences" onPress={search} loading={busy} />;
  } else if (step === 1) {
    body = (
      <>
        <Heading size={22} style={{ marginTop: 6 }}>Choose your residence</Heading>
        <Body muted style={{ marginTop: 4 }}>{dayLabel(stay.checkIn, { year: false })} – {dayLabel(stay.checkOut)} · {stay.guests} guest{stay.guests > 1 ? 's' : ''}</Body>
        {!options ? <Loading /> : null}
        {options && !options.length ? <Notice style={{ marginTop: 16 }}>No residences are available for these dates. Try other dates, or ask the concierge.</Notice> : null}
        {(options || []).map((o) => {
          const selected = choice?.categoryId === o.categoryId;
          return (
            <TouchableOpacity key={o.categoryId} activeOpacity={0.9} disabled={!o.unit} onPress={() => setChoice(o)} style={{ marginTop: 14, opacity: o.unit ? 1 : 0.45 }}>
              <Card padded={false} highlight={selected} style={selected ? { borderColor: COLORS.primary } : null}>
                <Image source={o.image ? { uri: fileUrl(o.image) } : require('../../../assets/explore.jpg')} style={s.resImage} />
                <View style={{ padding: 16 }}>
                  <View style={s.rowBetween}>
                    <Text style={s.resName}>{o.name}</Text>
                    {selected ? <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} /> : null}
                  </View>
                  {!!o.description && <Body muted numberOfLines={3} style={{ marginTop: 6, fontSize: 12.5 }}>{o.description}</Body>}
                  <View style={[s.rowBetween, { marginTop: 12 }]}>
                    <Text style={s.meta}>{[o.bedrooms ? `${o.bedrooms} bedroom${o.bedrooms > 1 ? 's' : ''}` : null, o.maxGuests ? `up to ${o.maxGuests} guests` : null].filter(Boolean).join(' · ')}</Text>
                    {o.unit ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.price}>{xaf(o.price)}<Text style={s.meta}> / night</Text></Text>
                        <Text style={s.meta}>{xaf(o.price * nights)} total</Text>
                      </View>
                    ) : (
                      <Text style={s.meta}>Not available</Text>
                    )}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </>
    );
    footer = <Button title={choice ? `Continue · ${xaf(total)}` : 'Choose a residence'} disabled={!choice} onPress={() => { setError(''); setStep(2); }} />;
  } else if (step === 2) {
    body = (
      <>
        <Heading size={22} style={{ marginTop: 6, marginBottom: 18 }}>Your details</Heading>
        <Field label="Full name" value={details.name} onChangeText={(name) => setDetails({ ...details, name })} autoComplete="name" textContentType="name" />
        <Field
          label="Email"
          value={details.email}
          onChangeText={(email) => setDetails({ ...details, email })}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!isAuthenticated}
          hint={isAuthenticated ? 'The booking is added to your account.' : 'Your confirmation, digital key and account details are sent here.'}
        />
        <Field label="Phone" value={details.phone} onChangeText={(phone) => setDetails({ ...details, phone })} keyboardType="phone-pad" autoComplete="tel" placeholder="+237 6XX XXX XXX" />
        <Field label="Special requests (optional)" value={details.requests} onChangeText={(requests) => setDetails({ ...details, requests })} multiline placeholder="Arrival time, celebrations, dietary needs…" maxLength={1000} />
      </>
    );
    footer = <Button title="Continue" onPress={toTerms} />;
  } else if (step === 3) {
    body = (
      <>
        <Heading size={22} style={{ marginTop: 6 }}>Terms of stay</Heading>
        <Body muted style={{ marginTop: 6 }}>Please read and accept before payment. We keep a dated record of your acceptance with your booking.</Body>
        <Card style={{ marginTop: 16 }}>
          {[
            ['time-outline', 'Check-in from 14:00, check-out until 11:00. Early or late on request.'],
            ['id-card-outline', 'Valid government ID is required at check-in.'],
            ['key-outline', 'Your digital access codes are sent by email before arrival and live in the app.'],
            ['return-up-back-outline', 'Cancellation: full refund minus fees more than 14 days before check-in, 50% from 7 to 14 days, none within 7 days or for a no-show.'],
            ['people-outline', 'Respect the maximum occupancy, quiet hours and our neighbours. No smoking indoors; pets only with written approval.'],
            ['cube-outline', 'Deliveries go to your private deposit box, opened with your own PIN.'],
          ].map(([icon, text]) => (
            <View key={icon} style={s.termRow}>
              <Ionicons name={icon} size={17} color={COLORS.primary} style={{ marginTop: 1 }} />
              <Text style={s.termText}>{text}</Text>
            </View>
          ))}
          <View style={s.links}>
            <Text style={s.link} onPress={() => navigation.navigate('Terms')}>Full terms of service</Text>
            <Text style={s.link} onPress={() => navigation.navigate('Privacy')}>Privacy policy</Text>
          </View>
        </Card>
        <View style={{ marginTop: 14 }}>
          <Checkbox checked={terms.terms} onChange={(v) => setTerms({ ...terms, terms: v })}>I have read and accept the Terms of Service and the Privacy Policy.</Checkbox>
          <Checkbox checked={terms.rules} onChange={(v) => setTerms({ ...terms, rules: v })}>I agree to the house rules and the deposit box policy.</Checkbox>
        </View>
      </>
    );
    footer = <Button title="Continue to payment" disabled={!terms.terms || !terms.rules} onPress={() => { setError(''); setStep(4); }} />;
  } else {
    body = (
      <>
        <Card highlight style={{ marginTop: 6 }}>
          <Text style={s.resName}>{choice.name}</Text>
          <Text style={[s.meta, { marginTop: 4 }]}>{dayLabel(stay.checkIn, { weekday: true, year: false })} – {dayLabel(stay.checkOut, { weekday: true })}</Text>
          <View style={[s.rowBetween, { marginTop: 12 }]}>
            <Text style={s.meta}>{xaf(choice.price)} × {nights} night{nights > 1 ? 's' : ''}</Text>
            <Text style={s.total}>{xaf(total)}</Text>
          </View>
        </Card>
        <SectionTitle>PAY WITH</SectionTitle>
        <ChipRow scroll={false} options={METHODS} value={method} onChange={(m) => { setError(''); setMethod(m); }} />
        {method === 'card' ? (
          <View style={{ marginTop: 18 }}>
            <Text style={s.label}>CARD DETAILS</Text>
            <CardField
              postalCodeEnabled={false}
              placeholders={{ number: '1234 1234 1234 1234' }}
              cardStyle={{ backgroundColor: '#1a1814', textColor: '#F2E9D8', placeholderColor: '#7d766a', borderColor: '#3a3428', borderWidth: 1, borderRadius: 10, fontSize: 15, cursorColor: '#C8A45D' }}
              style={{ width: '100%', height: 52 }}
              onCardChange={(card) => setCardComplete(card.complete)}
            />
            <View style={s.secure}>
              <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
              <Text style={s.meta}>Secured by Stripe. Faysha never sees your card number.</Text>
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 18 }}>
            <Field
              label={`${method === 'mtn' ? 'MTN' : 'Orange'} number to charge`}
              value={momoPhone}
              onChangeText={setMomoPhone}
              keyboardType="phone-pad"
              placeholder="+237 6XX XXX XXX"
              hint="You'll approve the payment on your phone. Your stay is confirmed as soon as it arrives."
            />
          </View>
        )}
      </>
    );
    footer = <Button title={method === 'card' ? `Pay ${xaf(total)}` : `Request ${xaf(total)}`} icon={method === 'card' ? 'lock-closed' : 'phone-portrait-outline'} onPress={pay} loading={busy} />;
  }

  return (
    <Screen title="Book your stay" subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} onBack={back} footer={<>{error ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 10 }}>{error}</Notice> : null}{footer}</>}>
      <View style={s.progress}>
        {STEPS.map((label, i) => (
          <View key={label} style={[s.bar, i <= step && s.barOn]} />
        ))}
      </View>
      {body}
    </Screen>
  );
}

const s = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 18 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(242,233,216,0.1)' },
  barOn: { backgroundColor: COLORS.primary },
  nights: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13, textAlign: 'center', marginTop: 6, letterSpacing: 1 },
  resImage: { width: '100%', height: 150 },
  resName: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 17, letterSpacing: 0.5, flexShrink: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  meta: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12 },
  price: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 14 },
  total: { fontFamily: FONTS.heading, color: COLORS.primary, fontSize: 18 },
  label: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 10.5, letterSpacing: 1.6, marginBottom: 8 },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  termRow: { flexDirection: 'row', gap: 12, paddingVertical: 7 },
  termText: { flex: 1, fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 18 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  link: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 12.5 },
  done: { alignItems: 'center', paddingTop: 50 },
  doneIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
});
