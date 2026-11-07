import React, { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, ErrorView, Field, Heading, Loading, Notice, Pill, Screen } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { useLiveEvent } from '../../contexts/LiveContext';
import useLoad from '../../hooks/useLoad';
import apiClient, { errorMessage } from '../../services/api';
import { dayLabel } from '../../utils/format';
import { fileUrl } from '../../config';
import { showAlert } from '../../components/Dialog';

const STATUS = {
  new: ['Received', 'gold'], assessing: ['We are preparing your proposal', 'blue'], quoted: ['Proposal ready', 'gold'], accepted: ['Accepted · deposit due', 'blue'],
  confirmed: ['Confirmed', 'green'], completed: ['Hosted', 'green'], declined: ['Declined', 'red'], cancelled: ['Cancelled', 'red'], lost: ['Closed', 'red'],
};
const money = (n, cur) => {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur || 'XAF', maximumFractionDigits: ['XAF', 'XOF'].includes(cur) ? 0 : 2 }).format(n || 0);
  } catch {
    return `${Math.round(n || 0).toLocaleString()} ${cur}`;
  }
};

const openUrl = (url) => url && Linking.openURL(url).catch(() => showAlert('Could not open the link', url));

function Proposal({ ev, onAnswered }) {
  const q = ev.quote;
  const [name, setName] = useState(ev.name || '');
  const [mode, setMode] = useState(null); // null | counter
  const [budget, setBudget] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const respond = async (decision) => {
    setBusy(true);
    try {
      await apiClient.post(`/events/quote/${ev.quoteToken}/respond`, { decision, name, note: note.trim() || undefined, budget: decision === 'counter' ? Number(budget.replace(/\D/g, '')) : undefined });
      if (decision === 'counter') showAlert('Budget sent', 'Thank you. Your coordinator is preparing a revised proposal around your budget; you will be notified when it is ready.');
      if (decision === 'accept') showAlert('Thank you', 'Your invoice is ready. Pay the deposit to secure your date.');
      setMode(null);
      onAnswered();
    } catch (e) {
      showAlert('Not recorded', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ marginTop: 14 }}>
      {q.images?.length ? (
        <>
          <Text style={s.eyebrow}>HOW WE SEE YOUR EVENT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4, marginBottom: 12 }}>
            {q.images.map((img, i) => (
              <View key={i} style={s.mood}>
                <Image source={{ uri: fileUrl(img.url) }} style={s.moodImg} />
                {img.caption ? <Text style={s.moodCap} numberOfLines={2}>{img.caption}</Text> : null}
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
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
      <Body muted style={{ fontSize: 12.5 }}>Deposit to reserve the date: {money(q.depositAmount, q.currency)} ({q.depositPercent}%).{q.validUntil && q.status === 'sent' ? ` Valid until ${dayLabel(q.validUntil)}.` : ''}</Body>
      {q.notes ? <Body muted style={{ fontSize: 12.5, marginTop: 8 }}>{q.notes}</Body> : null}
      {q.status === 'declined' && q.counterBudget ? (
        <Notice style={{ marginTop: 12 }}>We have your budget of {money(q.counterBudget, q.currency)}. Your coordinator is preparing a revised proposal.</Notice>
      ) : null}
      {q.status === 'sent' && mode !== 'counter' ? (
        <>
          <Field label="Your full name, to accept" value={name} onChangeText={setName} style={{ marginTop: 14 }} />
          <Button title="Accept the proposal" onPress={() => respond('accept')} loading={busy} disabled={!name.trim()} />
          <Button title="Too much? Tell us your budget" variant="ghost" icon="wallet-outline" onPress={() => setMode('counter')} style={{ marginTop: 8 }} />
          <Text style={s.declineLink} onPress={() => showAlert('Decline this proposal?', 'If it is only the price, tell us your budget instead and we will adjust it.', [{ text: 'Keep it', style: 'cancel' }, { text: 'Decline', style: 'destructive', onPress: () => respond('decline') }])}>
            Decline the proposal
          </Text>
        </>
      ) : null}
      {q.status === 'sent' && mode === 'counter' ? (
        <>
          <Body muted style={{ marginTop: 14, fontSize: 13 }}>Tell us what you would like to spend: we rework the proposal around it — the spaces, the menu, the details — and send you a new version.</Body>
          <Field label={`Your budget (${q.currency})`} value={budget} onChangeText={setBudget} keyboardType="number-pad" style={{ marginTop: 12 }} />
          <Field label="What matters most to you? (optional)" value={note} onChangeText={setNote} multiline maxLength={2000} />
          <Button title="Send my budget" onPress={() => respond('counter')} loading={busy} disabled={!(Number(budget.replace(/\D/g, '')) > 0)} />
          <Button title="Back" variant="ghost" onPress={() => setMode(null)} style={{ marginTop: 8 }} />
        </>
      ) : null}
      {q.status === 'accepted' && ev.account ? <Account ev={ev} /> : null}
    </View>
  );
}

/** Invoice, payments and receipts; paying opens the secure proposal page (card or mobile money). */
function Account({ ev }) {
  const a = ev.account;
  const cur = ev.quote.currency;
  return (
    <View style={s.account}>
      <View style={s.head}>
        <Text style={s.accTitle}>Invoice {a.invoiceNumber}</Text>
        <Pill label={a.paidInFull ? 'Paid in full' : a.depositDue > 0 ? 'Deposit due' : 'Balance due'} tone={a.paidInFull ? 'green' : 'gold'} />
      </View>
      <View style={s.line}><Text style={s.lineLabel}>Paid</Text><Text style={s.lineAmt}>{money(a.paid, cur)}</Text></View>
      <View style={[s.line, { borderBottomWidth: 0 }]}><Text style={s.lineLabel}>Balance</Text><Text style={s.lineAmt}>{money(a.balance, cur)}</Text></View>
      {a.payments.map((p) => (
        <TouchableOpacity key={p.id} style={s.receipt} onPress={() => openUrl(p.receiptUrl)} disabled={!p.receiptUrl}>
          <Ionicons name="receipt-outline" size={16} color={COLORS.primary} />
          <Text style={[s.lineLabel, { color: COLORS.text }]}>{p.receiptNumber || 'Receipt'} · {p.method}</Text>
          <Text style={s.lineAmt}>{money(p.amount, p.currency || cur)}</Text>
        </TouchableOpacity>
      ))}
      {!a.paidInFull ? (
        <Button title={a.depositDue > 0 ? `Pay the deposit · ${money(a.depositDue, cur)}` : `Pay the balance · ${money(a.balance, cur)}`} icon="lock-closed-outline" onPress={() => openUrl(ev.quote.link)} style={{ marginTop: 12 }} />
      ) : null}
      <Button title="View the invoice" variant="ghost" small icon="document-text-outline" onPress={() => openUrl(a.invoiceUrl)} style={{ marginTop: 8 }} />
      <Text style={s.small}>Pay only through Faysha (card or mobile money) or to the team at the residence against an official receipt. Our staff never ask for payment to a personal account.</Text>
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
  eyebrow: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 10.5, letterSpacing: 2, marginBottom: 8 },
  mood: { width: 210, marginHorizontal: 4 },
  moodImg: { width: 210, height: 150, borderRadius: 12, backgroundColor: COLORS.backgroundCard },
  moodCap: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 11.5, marginTop: 6 },
  declineLink: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12.5, textAlign: 'center', marginTop: 14, textDecorationLine: 'underline' },
  account: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.borderGold, backgroundColor: 'rgba(200,164,93,0.05)' },
  accTitle: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 15, flexShrink: 1 },
  receipt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  small: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 11, lineHeight: 16, marginTop: 10 },
});
