import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen, Card, Button, Pill, Loading, ErrorView, Empty, SectionTitle, Sheet, Field, ChipRow, Notice, Body } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import guest from '../../services/guestService';
import { errorMessage } from '../../services/api';
import useLoad from '../../hooks/useLoad';
import { useLiveEvent } from '../../contexts/LiveContext';
import { ago } from '../../utils/format';

const DEPARTMENTS = [
  { value: 'Housekeeping', label: 'Housekeeping', icon: 'sparkles-outline', ideas: ['Please clean the residence', 'Fresh towels, please', 'Turndown service tonight', 'Extra pillows'] },
  { value: 'Maintenance', label: 'Maintenance', icon: 'construct-outline', ideas: ['Air conditioning is not cooling', 'A light is not working', 'Water pressure is low', 'The TV is not working'] },
  { value: 'Concierge', label: 'Concierge', icon: 'person-outline', ideas: ['Recommend a restaurant in town', 'Arrange flowers for a celebration', 'Help with my luggage'] },
  { value: 'Wellness', label: 'Wellness', icon: 'leaf-outline', ideas: ['Book a massage', 'A private yoga session'] },
  { value: 'Dining', label: 'Dining', icon: 'restaurant-outline', ideas: ['Dietary requirements for my stay', 'Stock the fridge before I arrive'] },
  { value: 'Transportation', label: 'Transport', icon: 'car-outline', ideas: ['A driver for the day'] },
];

const CANCELLABLE = ['Received', 'Seen', 'Scheduled', 'On hold'];

/** Service requests to the property teams. They land in FAY OS → Service Requests and come back with live progress. */
export default function RequestsScreen({ navigation, route }) {
  const { data, setData, loading, error, refreshing, refresh, reload } = useLoad(() => guest.requests());
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useLiveEvent('request:updated', reload);

  useEffect(() => {
    const preset = route.params?.preset;
    if (preset) {
      setForm({ department: preset.department || 'Housekeeping', title: preset.title || '', notes: '', urgent: false });
      navigation.setParams({ preset: undefined });
    }
  }, [route.params?.preset, navigation]);

  const open = () => {
    setFormError('');
    setForm({ department: 'Housekeeping', title: '', notes: '', urgent: false });
  };

  const submit = async () => {
    if (!form.title.trim()) {
      setFormError('Tell us what you need');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const created = await guest.createRequest({ department: form.department, title: form.title.trim(), notes: form.notes.trim() || undefined, urgent: form.urgent });
      setData((list) => [created, ...(list || [])]);
      setForm(null);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const cancel = (request) =>
    Alert.alert('Cancel this request?', request.title, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await guest.cancelRequest(request.id);
            setData((list) => list.map((r) => (r.id === updated.id ? updated : r)));
          } catch (e) {
            Alert.alert('Could not cancel', errorMessage(e));
          }
        },
      },
    ]);

  const list = data || [];
  const active = list.filter((r) => r.open);
  const past = list.filter((r) => !r.open);
  const dept = DEPARTMENTS.find((d) => d.value === form?.department) || DEPARTMENTS[0];

  return (
    <Screen
      title="Requests"
      subtitle="Our team usually answers within minutes"
      onBack={() => navigation.goBack()}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={<Button title="New request" icon="add" onPress={open} />}
    >
      {loading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !list.length ? (
        <Empty icon="notifications-outline" title="Anything you need" text="Housekeeping, maintenance, a recommendation — ask here and follow it live." />
      ) : (
        <>
          {active.length ? <SectionTitle>IN PROGRESS</SectionTitle> : null}
          {active.map((r) => (
            <RequestCard key={r.id} request={r} onCancel={CANCELLABLE.includes(r.status) ? () => cancel(r) : null} />
          ))}
          {past.length ? <SectionTitle>EARLIER</SectionTitle> : null}
          {past.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </>
      )}

      <Sheet visible={Boolean(form)} onClose={() => setForm(null)} title="New request">
        {form && (
          <>
            <ChipRow options={DEPARTMENTS} value={form.department} onChange={(department) => setForm({ ...form, department })} />
            <View style={{ height: 16 }} />
            <Field label="What do you need?" value={form.title} onChangeText={(title) => setForm({ ...form, title })} placeholder="e.g. Fresh towels, please" maxLength={200} />
            <View style={s.ideas}>
              {dept.ideas.map((idea) => (
                <Text key={idea} style={s.idea} onPress={() => setForm({ ...form, title: idea })}>
                  {idea}
                </Text>
              ))}
            </View>
            <Field label="Details (optional)" value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} placeholder="Anything that helps the team" multiline maxLength={1000} />
            <View style={s.urgentRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.urgentTitle}>It's urgent</Text>
                <Body muted style={{ fontSize: 12 }}>For leaks, safety or anything that can't wait</Body>
              </View>
              <Switch value={form.urgent} onValueChange={(urgent) => setForm({ ...form, urgent })} trackColor={{ true: COLORS.primary, false: 'rgba(242,233,216,0.15)' }} thumbColor={COLORS.text}
          activeThumbColor={COLORS.text} />
            </View>
            {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{formError}</Notice> : null}
            <Button title="Send request" onPress={submit} loading={saving} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function RequestCard({ request: r, onCancel }) {
  return (
    <Card style={{ marginBottom: 10 }} highlight={r.open && r.priority === 'urgent'}>
      <View style={s.top}>
        <Text style={s.dept}>{r.department}{r.priority === 'urgent' ? ' · Urgent' : ''}</Text>
        <Pill label={r.status} />
      </View>
      <Text style={s.title}>{r.title}</Text>
      {!!r.notes && <Body muted style={{ marginTop: 4, fontSize: 12.5 }} numberOfLines={3}>{r.notes}</Body>}
      {!!r.resolution && <Body style={{ marginTop: 8, fontSize: 12.5 }}>“{r.resolution}”</Body>}
      <View style={s.bottom}>
        <Text style={s.meta}>{r.number} · {ago(r.createdAt)}</Text>
        {onCancel ? <Text style={s.cancel} onPress={onCancel}>Cancel</Text> : null}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dept: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 15 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  meta: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 11.5 },
  cancel: { fontFamily: FONTS.body, color: '#ff8a80', fontSize: 12 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4, marginBottom: 16 },
  idea: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 11.5, borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' },
  urgentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  urgentTitle: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 14 },
});
