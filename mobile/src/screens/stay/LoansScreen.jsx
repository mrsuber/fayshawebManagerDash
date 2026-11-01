import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Empty, ErrorView, Field, Loading, Notice, Pill, Screen, SectionTitle, Sheet, Stepper } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { useLiveEvent } from '../../contexts/LiveContext';
import useLoad from '../../hooks/useLoad';
import apiClient, { errorMessage } from '../../services/api';

const STATUS = { requested: ['Being prepared', 'gold'], ready: ['Ready', 'blue'], out: ['With you', 'green'], returned: ['Returned', 'grey'], cancelled: ['Cancelled', 'grey'], declined: ['Not available', 'red'], lost: ['Lost', 'red'] };
const when = (iso) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Extra lockers and equipment on loan (golf clubs and balls, sport and beach kit…): ask, collect, return.
 * A locker's code appears here once it is assigned.
 */
export default function LoansScreen({ navigation }) {
  const { data, loading, error, reload, refreshing, refresh } = useLoad(async () => {
    const [catalog, loans] = await Promise.all([apiClient.get('/guest/loans/catalog'), apiClient.get('/guest/loans')]);
    return { catalog, loans };
  });
  useLiveEvent('loan:ready', reload);
  useLiveEvent('loan:declined', reload);
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const ask = async () => {
    setBusy(true);
    setFormError('');
    try {
      await apiClient.post('/guest/loans', { category: asking.category, hours: asking.hours, reason: asking.reason.trim() || undefined });
      setAsking(null);
      reload();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const cancel = (l) =>
    Alert.alert('Cancel this request?', l.label, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: () => apiClient.post(`/guest/loans/${l.id}/cancel`).then(reload).catch((e) => Alert.alert('Not cancelled', errorMessage(e))) },
    ]);

  if (loading) return <Screen title="Lockers & equipment" onBack={() => navigation.goBack()}><Loading /></Screen>;
  if (error && !data) return <Screen title="Lockers & equipment" onBack={() => navigation.goBack()}><ErrorView message={error} onRetry={reload} /></Screen>;
  const open = data.loans.filter((l) => ['requested', 'ready', 'out'].includes(l.status));
  const past = data.loans.filter((l) => !['requested', 'ready', 'out'].includes(l.status));

  return (
    <Screen title="Lockers & equipment" onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh}>
      <Body muted style={{ marginTop: 10 }}>Need more space for your things, or clubs for the range? Ask here and the team prepares it for you.</Body>
      {open.length ? <SectionTitle>WITH YOU</SectionTitle> : null}
      {open.map((l) => {
        const [label, tone] = STATUS[l.status];
        return (
          <Card key={l.id} style={{ marginBottom: 10 }} highlight={l.status === 'ready'}>
            <View style={s.row}>
              <Text style={s.title}>{l.item ? `${l.item.name}` : l.label}</Text>
              <Pill label={l.overdue ? 'Please return' : label} tone={l.overdue ? 'red' : tone} />
            </View>
            {l.item ? <Text style={s.meta}>{l.item.code}{l.item.location ? ` · ${l.item.location}` : ''}</Text> : null}
            {l.pin ? (
              <View style={s.pin}>
                <Text style={s.meta}>LOCKER CODE</Text>
                <Text style={s.pinText}>{l.pin}</Text>
              </View>
            ) : null}
            <Text style={[s.meta, l.overdue && { color: '#ff6b6b' }]}>Return by {when(l.dueAt)}</Text>
            {l.status === 'requested' ? <Text style={s.link} onPress={() => cancel(l)}>Cancel request</Text> : null}
          </Card>
        );
      })}
      <SectionTitle>ASK FOR</SectionTitle>
      {!data.catalog.length ? <Empty icon="cube-outline" title="Nothing to lend yet" text="Ask the concierge — we will do our best." /> : null}
      {data.catalog.map((c) => (
        <Card key={c.category} style={{ marginBottom: 10 }} onPress={() => (c.free ? setAsking({ category: c.category, label: c.label, hours: c.hours, reason: '' }) : null)}>
          <View style={s.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <Ionicons name={c.icon} size={22} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{c.label}</Text>
                <Text style={s.meta}>{c.free ? `${c.free} available · usually ${c.hours} h` : 'All in use right now'}</Text>
              </View>
            </View>
            {c.free ? <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} /> : null}
          </View>
        </Card>
      ))}
      {past.length ? <SectionTitle>EARLIER</SectionTitle> : null}
      {past.slice(0, 10).map((l) => (
        <View key={l.id} style={s.past}>
          <Text style={s.meta}>{l.item ? l.item.name : l.label}</Text>
          <Text style={s.meta}>{STATUS[l.status][0]}</Text>
        </View>
      ))}

      <Sheet visible={Boolean(asking)} onClose={() => setAsking(null)} title={asking?.label || ''}>
        {asking ? (
          <>
            <Stepper label="For how many hours" value={asking.hours} min={1} max={168} onChange={(hours) => setAsking({ ...asking, hours })} />
            <Field label="Anything we should know (optional)" value={asking.reason} onChangeText={(reason) => setAsking({ ...asking, reason })} placeholder={asking.category === 'locker' ? 'Shopping from the market, a large suitcase…' : 'Number of players, left-handed clubs…'} multiline maxLength={300} />
            {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{formError}</Notice> : null}
            <Button title="Send request" onPress={ask} loading={busy} />
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
  pin: { marginVertical: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
  pinText: { fontFamily: FONTS.heading, color: COLORS.primary, fontSize: 30, letterSpacing: 10, marginTop: 4 },
  link: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13, marginTop: 10 },
  past: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
});
