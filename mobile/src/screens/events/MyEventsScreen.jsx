import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, ErrorView, Field, Heading, Loading, Notice, Pill, Screen } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { useLiveEvent } from '../../contexts/LiveContext';
import useLoad from '../../hooks/useLoad';
import apiClient, { errorMessage } from '../../services/api';
import { dayLabel } from '../../utils/format';
import { showAlert } from '../../components/Dialog';

const STATUS = {
  new: ['Received', 'gold'], assessing: ['We are preparing your proposal', 'blue'], quoted: ['Proposal ready', 'gold'], accepted: ['Accepted · deposit pending', 'blue'],
  confirmed: ['Confirmed', 'green'], completed: ['Hosted', 'green'], declined: ['Declined', 'red'], cancelled: ['Cancelled', 'red'], lost: ['Closed', 'red'],
};
const money = (n, cur) => {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur || 'XAF', maximumFractionDigits: ['XAF', 'XOF'].includes(cur) ? 0 : 2 }).format(n || 0);
  } catch {
    return `${Math.round(n || 0).toLocaleString()} ${cur}`;
  }
};

function Proposal({ ev, onAnswered }) {
  const q = ev.quote;
  const [name, setName] = useState(ev.name || '');
  const [busy, setBusy] = useState(false);
  const respond = async (decision) => {
    setBusy(true);
    try {
      await apiClient.post(`/events/quote/${ev.quoteToken}/respond`, { decision, name });
      onAnswered();
    } catch (e) {
      showAlert('Not recorded', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ marginTop: 14 }}>
      {q.items.map((it, i) => (
        <View key={i} style={s.line}>
          <Text style={s.lineLabel}>{it.label}{it.qty !== 1 ? ` × ${it.qty}${it.unit ? ` ${it.unit}` : ''}` : ''}</Text>
          <Text style={s.lineAmt}>{money(it.qty * it.unitPrice, q.currency)}</Text>
        </View>
      ))}
      {q.discount ? <View style={s.line}><Text style={s.lineLabel}>Discount</Text><Text style={s.lineAmt}>− {money(q.discount, q.currency)}</Text></View> : null}
      {q.tax ? <View style={s.line}><Text style={s.lineLabel}>Tax ({q.taxRate}%)</Text><Text style={s.lineAmt}>{money(q.tax, q.currency)}</Text></View> : null}
      <View style={[s.line, { borderBottomWidth: 0 }]}>
        <Text style={s.total}>Total</Text>
        <Text style={s.total}>{money(q.total, q.currency)}</Text>
      </View>
      <Body muted style={{ fontSize: 12.5 }}>Deposit to reserve the date: {money(q.depositAmount, q.currency)} ({q.depositPercent}%).{q.validUntil ? ` Valid until ${dayLabel(q.validUntil)}.` : ''}</Body>
      {q.notes ? <Body muted style={{ fontSize: 12.5, marginTop: 8 }}>{q.notes}</Body> : null}
      {q.status === 'sent' ? (
        <>
          <Field label="Your full name, to accept" value={name} onChangeText={setName} style={{ marginTop: 14 }} />
          <Button title="Accept the proposal" onPress={() => respond('accept')} loading={busy} disabled={!name.trim()} />
          <Button title="Decline" variant="ghost" onPress={() => showAlert('Decline this proposal?', 'You can still ask us for changes by replying to our email.', [{ text: 'Keep it' }, { text: 'Decline', style: 'destructive', onPress: () => respond('decline') }])} style={{ marginTop: 8 }} />
        </>
      ) : null}
    </View>
  );
}

/** The guest's event requests, their status and the proposal to accept. */
export default function MyEventsScreen({ navigation }) {
  const { data, loading, error, reload, refreshing, refresh } = useLoad(() => apiClient.get('/events/mine'));
  const [open, setOpen] = useState(null);
  useLiveEvent('event:quote', reload);
  if (loading) return <Screen title="My events" onBack={() => navigation.goBack()}><Loading /></Screen>;
  if (error && !data) return <Screen title="My events" onBack={() => navigation.goBack()}><ErrorView message={error} onRetry={reload} /></Screen>;
  return (
    <Screen title="My events" onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh}>
      {!data?.length ? (
        <View style={{ paddingTop: 30 }}>
          <Heading size={24}>Celebrate at Faysha</Heading>
          <Body style={{ marginTop: 10 }}>Weddings, birthdays, retreats and private dinners — tailored to you, with our kitchen and our residences for your guests.</Body>
        </View>
      ) : null}
      {(data || []).map((ev) => {
        const [label, tone] = STATUS[ev.status] || [ev.status, 'gold'];
        const expanded = open === ev.id || (ev.quote?.status === 'sent' && open === null);
        return (
          <Card key={ev.id} style={{ marginTop: 14 }} onPress={() => setOpen(expanded ? -1 : ev.id)} highlight={ev.quote?.status === 'sent'}>
            <View style={s.head}>
              <Text style={s.title}>{ev.title || ev.typeLabel}</Text>
              <Pill label={label} tone={tone} />
            </View>
            <Text style={s.meta}>{ev.reference} · {ev.eventDate ? dayLabel(ev.eventDate, { weekday: true }) : 'Flexible dates'} · {ev.guests} guests</Text>
            {ev.status === 'accepted' ? <Notice style={{ marginTop: 12 }}>Thank you for accepting. Your coordinator will send payment details; the date is reserved when the deposit arrives.</Notice> : null}
            {expanded && ev.quote ? <Proposal ev={ev} onAnswered={reload} /> : null}
          </Card>
        );
      })}
      <Button title="Plan an event" icon="sparkles-outline" onPress={() => navigation.navigate('PlanEvent')} style={{ marginTop: 24 }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 17, flexShrink: 1 },
  meta: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  lineLabel: { flex: 1, fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 13 },
  lineAmt: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 13 },
  total: { fontFamily: FONTS.heading, color: COLORS.primary, fontSize: 17 },
});
