import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Checkbox, Chip, ChipRow, Field, Heading, Notice, PickerField, Screen, SectionTitle, Stepper } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import apiClient, { errorMessage } from '../../services/api';
import { addDays, isoDay } from '../../utils/format';

const TYPES = [
  ['wedding', 'Wedding'], ['engagement', 'Engagement'], ['birthday', 'Birthday'], ['anniversary', 'Anniversary'], ['corporate', 'Corporate'],
  ['conference', 'Conference'], ['retreat', 'Retreat'], ['private_dinner', 'Private dinner'], ['other', 'Something else'],
];
const SPACES = [['garden', 'Gardens'], ['pool_deck', 'Pool deck'], ['restaurant', 'Restaurant'], ['sky_deck', 'Sky deck'], ['lounge', 'Lounge'], ['wellness_club', 'Wellness club'], ['whole_estate', 'Whole estate']];
const SERVICES = [['decor', 'Decor'], ['flowers', 'Flowers'], ['sound', 'Sound & DJ'], ['lighting', 'Lighting'], ['photo', 'Photography'], ['video', 'Video'], ['cake', 'Cake'], ['officiant', 'Officiant'], ['transport', 'Guest transport'], ['security', 'Security'], ['wellness', 'Spa for the party'], ['kids', 'Children’s corner']];
const STEPS = ['The occasion', 'Spaces & food', 'Services & budget', 'Your details'];

function MultiChips({ options, value, onChange }) {
  return (
    <View style={s.wrap}>
      {options.map(([v, label]) => (
        <Chip key={v} label={label} active={value.includes(v)} onPress={() => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])} />
      ))}
    </View>
  );
}

/**
 * Plan an event (wedding, celebration, corporate day…), signed in or not. Prices are tailored, so this sends a
 * request; the events team assesses it and sends a proposal, which the guest accepts in "My events".
 */
export default function PlanEventScreen({ navigation }) {
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState(0);
  const [v, setV] = useState({
    eventType: '', eventDate: addDays(new Date(), 60), flexibleDates: false, guests: 50, startTime: '', spaces: [], catering: 'faysha', cateringStyle: '',
    dietary: '', services: [], roomsNeeded: 0, budgetMin: '', budgetMax: '', message: '',
    name: user?.fullName || '', email: user?.email || '', phone: user?.phone || '', organisation: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));

  const problem = () => {
    if (step === 0 && !v.eventType) return 'Choose the kind of event';
    if (step === 3 && (!v.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))) return 'Please give your name and a valid email';
    return '';
  };
  const next = () => {
    const p = problem();
    setError(p);
    if (!p) setStep(step + 1);
  };
  const send = async () => {
    const p = problem();
    if (p) return setError(p);
    setBusy(true);
    setError('');
    try {
      const r = await apiClient.post('/events', {
        ...v,
        eventDate: v.flexibleDates ? null : isoDay(v.eventDate),
        guests: Number(v.guests),
        roomsNeeded: Number(v.roomsNeeded) || 0,
        budgetMin: v.budgetMin || null,
        budgetMax: v.budgetMax || null,
        currency: 'XAF',
        source: 'app',
      });
      setDone(r.reference);
    } catch (e) {
      setError(errorMessage(e, 'Your request could not be sent. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Text style={s.ref}>{done}</Text>
          <Heading size={26} style={{ textAlign: 'center' }}>Thank you — we will be in touch</Heading>
          <Body style={{ textAlign: 'center', marginTop: 12 }}>
            Our events team will call or write within one working day. Your tailored proposal will appear {isAuthenticated ? 'in My events' : 'in your email'}, ready to accept.
          </Body>
        </View>
        {isAuthenticated ? <Button title="My events" onPress={() => navigation.replace('MyEvents')} style={{ marginTop: 28 }} /> : null}
        <Button title="Done" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
      </Screen>
    );
  }

  let body;
  if (step === 0) {
    body = (
      <>
        <Heading size={22} style={{ marginTop: 6 }}>What are you celebrating?</Heading>
        <View style={[s.wrap, { marginTop: 14 }]}>
          {TYPES.map(([k, l]) => (
            <Chip key={k} label={l} active={v.eventType === k} onPress={() => set('eventType')(k)} />
          ))}
        </View>
        <SectionTitle>WHEN AND HOW MANY</SectionTitle>
        {!v.flexibleDates ? <PickerField label="Preferred date" value={v.eventDate} minimumDate={addDays(new Date(), 1)} onChange={set('eventDate')} /> : null}
        <Checkbox checked={v.flexibleDates} onChange={set('flexibleDates')}>My dates are flexible</Checkbox>
        <Stepper label="Guests" value={v.guests} min={1} max={2000} onChange={set('guests')} />
        <Field label="Starts at (optional)" value={v.startTime} onChangeText={set('startTime')} placeholder="16:00" keyboardType="numbers-and-punctuation" />
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <Heading size={22} style={{ marginTop: 6 }}>Spaces and food</Heading>
        <SectionTitle>WHERE</SectionTitle>
        <MultiChips options={SPACES} value={v.spaces} onChange={set('spaces')} />
        <SectionTitle>FOOD AND DRINKS</SectionTitle>
        <ChipRow scroll={false} options={[{ value: 'faysha', label: 'Our restaurant' }, { value: 'external', label: 'My own caterer' }, { value: 'none', label: 'No catering' }]} value={v.catering} onChange={set('catering')} />
        {v.catering === 'faysha' ? (
          <>
            <View style={{ height: 12 }} />
            <ChipRow options={[{ value: 'plated', label: 'Plated' }, { value: 'buffet', label: 'Buffet' }, { value: 'cocktail', label: 'Cocktail' }, { value: 'family', label: 'Family style' }, { value: 'bbq', label: 'Barbecue' }]} value={v.cateringStyle} onChange={set('cateringStyle')} />
            <Field label="Dietary needs" value={v.dietary} onChangeText={set('dietary')} placeholder="Vegetarian guests, allergies, halal…" multiline style={{ marginTop: 14 }} />
          </>
        ) : null}
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <Heading size={22} style={{ marginTop: 6 }}>Services and budget</Heading>
        <SectionTitle>WHAT SHOULD WE TAKE CARE OF?</SectionTitle>
        <MultiChips options={SERVICES} value={v.services} onChange={set('services')} />
        <Stepper label="Residences for overnight guests" value={v.roomsNeeded} min={0} max={50} onChange={set('roomsNeeded')} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Budget from (XAF)" value={String(v.budgetMin)} onChangeText={set('budgetMin')} keyboardType="number-pad" style={{ flex: 1 }} />
          <Field label="Up to (XAF)" value={String(v.budgetMax)} onChangeText={set('budgetMax')} keyboardType="number-pad" style={{ flex: 1 }} />
        </View>
        <Field label="Describe the day you imagine" value={v.message} onChangeText={set('message')} multiline placeholder="The atmosphere, the timeline, anything important to you…" maxLength={5000} />
      </>
    );
  } else {
    body = (
      <>
        <Heading size={22} style={{ marginTop: 6, marginBottom: 14 }}>Your details</Heading>
        <Field label="Full name" value={v.name} onChangeText={set('name')} autoComplete="name" />
        <Field label="Email" value={v.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" editable={!isAuthenticated} />
        <Field label="Phone" value={v.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="+237 6XX XXX XXX" />
        <Field label="Company (optional)" value={v.organisation} onChangeText={set('organisation')} />
        <Card style={{ marginTop: 8 }}>
          <Body muted style={{ fontSize: 12.5 }}>Every event is priced after we assess it with you. Sending this request commits you to nothing.</Body>
        </Card>
      </>
    );
  }

  return (
    <Screen
      title="Plan an event"
      subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
      onBack={() => (step ? setStep(step - 1) : navigation.goBack())}
      footer={
        <>
          {error ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 10 }}>{error}</Notice> : null}
          {step < 3 ? <Button title="Continue" onPress={next} /> : <Button title="Send my request" onPress={send} loading={busy} />}
        </>
      }
    >
      <View style={s.progress}>
        {STEPS.map((l, i) => (
          <View key={l} style={[s.bar, i <= step && s.barOn]} />
        ))}
      </View>
      {body}
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  progress: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 18 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(242,233,216,0.1)' },
  barOn: { backgroundColor: COLORS.primary },
  ref: { fontFamily: FONTS.body, color: COLORS.primary, letterSpacing: 2, fontSize: 12, marginBottom: 10 },
});
