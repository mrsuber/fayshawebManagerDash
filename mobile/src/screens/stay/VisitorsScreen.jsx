import React, { useState } from 'react';
import { Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Empty, ErrorView, Field, Loading, Notice, Pill, PickerField, Screen, SectionTitle, Sheet, Stepper } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { useLiveEvent } from '../../contexts/LiveContext';
import useLoad from '../../hooks/useLoad';
import apiClient, { errorMessage } from '../../services/api';
import { addDays, dayLabel, isoDay, xaf } from '../../utils/format';
import { showAlert } from '../../components/Dialog';

const STATUS = { pending: ['Awaiting approval', 'gold'], approved: ['Pass active', 'green'], arrived: ['Arrived', 'blue'], left: ['Left', 'grey'], declined: ['Declined', 'red'], cancelled: ['Cancelled', 'grey'], expired: ['Expired', 'grey'] };
const GUEST_STATUS = { pending: ['Awaiting approval', 'gold'], approved: ['Registered', 'green'], declined: ['Declined', 'red'] };
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const at = (time) => {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

/**
 * Visitors under the house rules: day passes (QR, code and directions for the gate) within visiting hours, a
 * discreet option, and — for anyone who will sleep here — adding them to the stay, within the residence's capacity.
 */
export default function VisitorsScreen({ navigation }) {
  const { data, loading, error, reload, refreshing, refresh } = useLoad(() => apiClient.get('/guest/visitors', { params: { full: 1 } }));
  useLiveEvent('visitor:updated', reload);
  const [form, setForm] = useState(null);
  const [guestForm, setGuestForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const policy = data?.policy || { visitFrom: '08:00', visitUntil: '22:00', maxPeoplePerVisit: 4, allowDiscreet: true };

  const share = (p) =>
    Share.share({
      message: `Hello ${p.visitorName.split(' ')[0]}, here is your pass to visit me at Faysha Wellness Residence on ${dayLabel(p.date, { weekday: true })}${p.from ? ` from ${p.from}` : ''}${p.until ? ` until ${p.until}` : ''}: ${p.link}\nShow it at the gate with your ID${p.status === 'approved' ? ` (code ${p.code})` : ''}.`,
    });

  const invite = async () => {
    setBusy(true);
    setFormError('');
    try {
      const p = await apiClient.post('/guest/visitors', {
        visitorName: form.name.trim(), visitorPhone: form.phone.trim() || undefined, people: form.people, vehicle: form.vehicle.trim() || undefined,
        date: isoDay(form.date), from: form.from ? hhmm(form.from) : undefined, until: hhmm(form.until), note: form.note.trim() || undefined, discreet: form.discreet,
      });
      setForm(null);
      await reload();
      if (p.status === 'approved') share(p);
      else if (p.flag) showAlert('Sent for approval', `${p.visitorName} has visited often this week, so the residence team will look at this pass. If they are staying with you, add them to your stay instead.`);
      else showAlert('Request sent', 'The residence team approves visitor passes. You will be notified, and can then send the pass to your visitor.');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const addGuest = async () => {
    setBusy(true);
    setFormError('');
    try {
      await apiClient.post('/guest/visitors/guests', {
        fullName: guestForm.name.trim(), phone: guestForm.phone.trim() || undefined, relation: guestForm.relation.trim() || undefined,
        from: isoDay(guestForm.from), to: isoDay(guestForm.to), note: guestForm.note.trim() || undefined,
      });
      setGuestForm(null);
      await reload();
      showAlert('Request sent', 'The residence team will confirm. Your guest then comes in with you, or shows ID at the gate.');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen title="Visitors" onBack={() => navigation.goBack()}><Loading /></Screen>;
  if (error && !data) return <Screen title="Visitors" onBack={() => navigation.goBack()}><ErrorView message={error} onRetry={reload} /></Screen>;
  const passes = Array.isArray(data) ? data : data?.passes || [];
  const guests = data?.guests || [];
  const upcoming = passes.filter((p) => ['pending', 'approved', 'arrived'].includes(p.status));
  const past = passes.filter((p) => !['pending', 'approved', 'arrived'].includes(p.status));
  const openInvite = () => {
    setFormError('');
    setForm({ name: '', phone: '', people: 1, vehicle: '', date: new Date(), from: null, until: at(policy.visitUntil), note: '', discreet: false });
  };
  const openGuest = () => {
    setFormError('');
    const start = new Date();
    setGuestForm({ name: '', phone: '', relation: '', from: start, to: addDays(start, 1), note: '' });
  };

  return (
    <Screen title="Visitors" onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh} footer={<Button title="Invite a visitor" icon="person-add-outline" onPress={openInvite} />}>
      <Card style={{ marginTop: 10 }}>
        <View style={s.rulesHead}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
          <Text style={s.rulesTitle}>House rules for visitors</Text>
        </View>
        <Text style={s.rule}>• Visits from {policy.visitFrom} to {policy.visitUntil}, up to {policy.maxPeoplePerVisit} people per pass.</Text>
        <Text style={s.rule}>• Visitors show the pass and their ID at the gate. We tell you when they arrive.</Text>
        <Text style={s.rule}>• No one sleeps over on a visitor pass: add them to your stay below.</Text>
        {policy.allowDiscreet ? <Text style={s.rule}>• Prefer privacy? Ask for a discreet visit: staff lists show “Private visitor”.</Text> : null}
      </Card>

      {!upcoming.length && !past.length ? <Empty icon="people-outline" title="No visitors yet" text="Invite friends or family for the days of your stay." /> : null}
      {upcoming.length ? <SectionTitle>EXPECTED</SectionTitle> : null}
      {upcoming.map((p) => {
        const [label, tone] = STATUS[p.status];
        return (
          <Card key={p.id} style={{ marginBottom: 10 }}>
            <View style={s.row}>
              <Text style={s.title}>
                {p.discreet ? <Ionicons name="eye-off-outline" size={14} color={COLORS.textTertiary} /> : null} {p.visitorName}
              </Text>
              <Pill label={label} tone={tone} />
            </View>
            <Text style={s.meta}>
              {dayLabel(p.date, { weekday: true })}
              {p.from ? ` · ${p.from}${p.until ? `–${p.until}` : ''}` : p.until ? ` · until ${p.until}` : ''} · {p.people} person{p.people > 1 ? 's' : ''}
              {p.vehicle ? ` · ${p.vehicle}` : ''}
            </Text>
            {p.status === 'approved' ? <Text style={s.code}>Gate code {p.code}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 18, marginTop: 10 }}>
              {p.status === 'approved' ? <Text style={s.link} onPress={() => share(p)}>Send the pass</Text> : null}
              {['pending', 'approved'].includes(p.status) ? (
                <Text style={s.link} onPress={() => apiClient.post(`/guest/visitors/${p.id}/cancel`).then(reload).catch((e) => showAlert('Not cancelled', errorMessage(e)))}>Cancel</Text>
              ) : null}
            </View>
          </Card>
        );
      })}

      <SectionTitle>STAYING THE NIGHT</SectionTitle>
      <Card>
        <Body muted style={{ fontSize: 13 }}>
          Someone joining you overnight is registered on your stay, so security knows they live here for those nights.
          {data?.capacity ? ` Your residence sleeps up to ${data.capacity}; your booking is for ${data.booked}.` : ''}
          {policy.extraGuestFeePerNight ? ` ${xaf(policy.extraGuestFeePerNight)} per guest per night is added to your bill.` : ''}
        </Body>
        {guests.map((g) => {
          const [label, tone] = GUEST_STATUS[g.status] || [g.status, 'grey'];
          return (
            <View key={g.id} style={s.guest}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{g.fullName}{g.relation ? <Text style={s.meta}> · {g.relation}</Text> : null}</Text>
                <Text style={s.meta}>
                  {dayLabel(g.from, { year: false })} → {dayLabel(g.to, { year: false })} · {g.nights} night{g.nights > 1 ? 's' : ''}
                  {g.fee ? ` · ${xaf(g.fee)}` : ''}
                  {g.declineReason ? ` · ${g.declineReason}` : ''}
                </Text>
                {g.status === 'pending' ? (
                  <Text style={[s.link, { marginTop: 6 }]} onPress={() => apiClient.post(`/guest/visitors/guests/${g.id}/cancel`).then(reload).catch((e) => showAlert('Not cancelled', errorMessage(e)))}>Cancel request</Text>
                ) : null}
              </View>
              <Pill label={label} tone={tone} />
            </View>
          );
        })}
        <Button title="Add a guest to my stay" variant="ghost" small icon="bed-outline" onPress={openGuest} style={{ marginTop: 14 }} />
      </Card>

      {past.length ? <SectionTitle>EARLIER</SectionTitle> : null}
      {past.slice(0, 10).map((p) => (
        <View key={p.id} style={s.past}>
          <Text style={s.meta}>{p.visitorName} · {dayLabel(p.date)}</Text>
          <Text style={s.meta}>{STATUS[p.status][0]}</Text>
        </View>
      ))}

      <Sheet visible={Boolean(form)} onClose={() => setForm(null)} title="Invite a visitor">
        {form ? (
          <>
            <Field label="Visitor's full name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} autoComplete="name" hint="As on their ID: the gate checks it" />
            <Field label="Their phone (optional)" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" />
            <PickerField label="Day" value={form.date} minimumDate={new Date()} onChange={(date) => setForm({ ...form, date })} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <PickerField label="Arriving from" mode="time" value={form.from || at(policy.visitFrom)} onChange={(from) => setForm({ ...form, from })} />
              </View>
              <View style={{ flex: 1 }}>
                <PickerField label={`Leaving by (≤ ${policy.visitUntil})`} mode="time" value={form.until} onChange={(until) => setForm({ ...form, until })} />
              </View>
            </View>
            <Stepper label="People" value={form.people} min={1} max={policy.maxPeoplePerVisit || 4} onChange={(people) => setForm({ ...form, people })} />
            <Field label="Car plate (optional)" value={form.vehicle} onChangeText={(vehicle) => setForm({ ...form, vehicle })} autoCapitalize="characters" />
            <Field label="Note for security (optional)" value={form.note} onChangeText={(note) => setForm({ ...form, note })} multiline maxLength={300} />
            {policy.allowDiscreet ? (
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>Discreet visit</Text>
                  <Text style={s.meta}>Staff lists and alerts show “Private visitor”. Security still checks the pass and ID at the gate.</Text>
                </View>
                <Switch value={form.discreet} onValueChange={(discreet) => setForm({ ...form, discreet })} trackColor={{ true: COLORS.primary }} />
              </View>
            ) : null}
            {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{formError}</Notice> : null}
            <Button title="Create pass" onPress={invite} loading={busy} disabled={!form.name.trim()} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={Boolean(guestForm)} onClose={() => setGuestForm(null)} title="Add a guest to my stay">
        {guestForm ? (
          <>
            <Field label="Full name" value={guestForm.name} onChangeText={(name) => setGuestForm({ ...guestForm, name })} autoComplete="name" hint="As on their ID" />
            <Field label="Relation (optional)" value={guestForm.relation} onChangeText={(relation) => setGuestForm({ ...guestForm, relation })} placeholder="Partner, sister, colleague…" />
            <Field label="Phone (optional)" value={guestForm.phone} onChangeText={(phone) => setGuestForm({ ...guestForm, phone })} keyboardType="phone-pad" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <PickerField label="First night" value={guestForm.from} minimumDate={new Date()} onChange={(from) => setGuestForm({ ...guestForm, from, to: guestForm.to <= from ? addDays(from, 1) : guestForm.to })} />
              </View>
              <View style={{ flex: 1 }}>
                <PickerField label="Leaves on" value={guestForm.to} minimumDate={addDays(guestForm.from, 1)} onChange={(to) => setGuestForm({ ...guestForm, to })} />
              </View>
            </View>
            <Field label="Note (optional)" value={guestForm.note} onChangeText={(note) => setGuestForm({ ...guestForm, note })} multiline maxLength={300} />
            {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{formError}</Notice> : null}
            <Button title="Send request" onPress={addGuest} loading={busy} disabled={!guestForm.name.trim()} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  meta: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 5 },
  code: { fontFamily: FONTS.heading, color: COLORS.primary, fontSize: 16, letterSpacing: 3, marginTop: 8 },
  link: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13.5 },
  past: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rulesHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rulesTitle: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 15, letterSpacing: 0.4 },
  rule: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 19, marginTop: 2 },
  guest: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
});
