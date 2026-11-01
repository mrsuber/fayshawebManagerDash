import React, { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Empty, ErrorView, Field, Loading, Notice, Pill, PickerField, Screen, SectionTitle, Sheet, Stepper } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { useLiveEvent } from '../../contexts/LiveContext';
import useLoad from '../../hooks/useLoad';
import apiClient, { errorMessage } from '../../services/api';
import { dayLabel, isoDay } from '../../utils/format';

const STATUS = { pending: ['Awaiting approval', 'gold'], approved: ['Pass active', 'green'], arrived: ['Arrived', 'blue'], left: ['Left', 'grey'], declined: ['Declined', 'red'], cancelled: ['Cancelled', 'grey'], expired: ['Expired', 'grey'] };
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Inviting visitors: the visitor gets a pass (link with QR code, code and directions) to show at the gate; the
 * resident is told when they arrive.
 */
export default function VisitorsScreen({ navigation }) {
  const { data, loading, error, reload, refreshing, refresh } = useLoad(() => apiClient.get('/guest/visitors'));
  useLiveEvent('visitor:updated', reload);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const share = (p) =>
    Share.share({
      message: `Hello ${p.visitorName.split(' ')[0]}, here is your pass to visit me at Faysha Wellness Residence on ${dayLabel(p.date, { weekday: true })}${p.from ? ` from ${p.from}` : ''}: ${p.link}\nShow it at the gate${p.status === 'approved' ? ` (code ${p.code})` : ''}.`,
    });

  const invite = async () => {
    setBusy(true);
    setFormError('');
    try {
      const p = await apiClient.post('/guest/visitors', {
        visitorName: form.name.trim(), visitorPhone: form.phone.trim() || undefined, people: form.people, vehicle: form.vehicle.trim() || undefined,
        date: isoDay(form.date), from: form.from ? hhmm(form.from) : undefined, note: form.note.trim() || undefined,
      });
      setForm(null);
      await reload();
      if (p.status === 'approved') share(p);
      else Alert.alert('Request sent', 'The residence team approves visitor passes. You will be notified, and can then send the pass to your visitor.');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen title="Visitors" onBack={() => navigation.goBack()}><Loading /></Screen>;
  if (error && !data) return <Screen title="Visitors" onBack={() => navigation.goBack()}><ErrorView message={error} onRetry={reload} /></Screen>;
  const upcoming = (data || []).filter((p) => ['pending', 'approved', 'arrived'].includes(p.status));
  const past = (data || []).filter((p) => !['pending', 'approved', 'arrived'].includes(p.status));

  return (
    <Screen
      title="Visitors"
      onBack={() => navigation.goBack()}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={<Button title="Invite a visitor" icon="person-add-outline" onPress={() => setForm({ name: '', phone: '', people: 1, vehicle: '', date: new Date(), from: null, note: '' })} />}
    >
      <Body muted style={{ marginTop: 10 }}>Your visitor receives a pass with directions and a QR code for the gate. We let you know when they arrive.</Body>
      {!upcoming.length && !past.length ? <Empty icon="people-outline" title="No visitors yet" text="Invite friends or family for the days of your stay." /> : null}
      {upcoming.length ? <SectionTitle>EXPECTED</SectionTitle> : null}
      {upcoming.map((p) => {
        const [label, tone] = STATUS[p.status];
        return (
          <Card key={p.id} style={{ marginBottom: 10 }}>
            <View style={s.row}>
              <Text style={s.title}>{p.visitorName}</Text>
              <Pill label={label} tone={tone} />
            </View>
            <Text style={s.meta}>{dayLabel(p.date, { weekday: true })}{p.from ? ` · from ${p.from}` : ''} · {p.people} person{p.people > 1 ? 's' : ''}{p.vehicle ? ` · ${p.vehicle}` : ''}</Text>
            {p.status === 'approved' ? <Text style={s.code}>Gate code {p.code}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 18, marginTop: 10 }}>
              {p.status === 'approved' ? <Text style={s.link} onPress={() => share(p)}>Send the pass</Text> : null}
              {['pending', 'approved'].includes(p.status) ? (
                <Text style={s.link} onPress={() => apiClient.post(`/guest/visitors/${p.id}/cancel`).then(reload).catch((e) => Alert.alert('Not cancelled', errorMessage(e)))}>Cancel</Text>
              ) : null}
            </View>
          </Card>
        );
      })}
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
            <Field label="Visitor's full name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} autoComplete="name" />
            <Field label="Their phone (optional)" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" />
            <PickerField label="Day" value={form.date} minimumDate={new Date()} onChange={(date) => setForm({ ...form, date })} />
            <PickerField label="Arriving from (optional)" mode="time" value={form.from || new Date()} onChange={(from) => setForm({ ...form, from })} />
            <Stepper label="People" value={form.people} min={1} max={20} onChange={(people) => setForm({ ...form, people })} />
            <Field label="Car plate (optional)" value={form.vehicle} onChangeText={(vehicle) => setForm({ ...form, vehicle })} autoCapitalize="characters" />
            <Field label="Note for security (optional)" value={form.note} onChangeText={(note) => setForm({ ...form, note })} multiline maxLength={300} />
            {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{formError}</Notice> : null}
            <Button title="Create pass" onPress={invite} loading={busy} disabled={!form.name.trim()} />
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
});
