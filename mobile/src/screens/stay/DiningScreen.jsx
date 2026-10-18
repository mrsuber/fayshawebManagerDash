import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Screen, Card, Button, Pill, Loading, ErrorView, Empty, SectionTitle, Sheet, Field, ChipRow, Notice, Body, PickerField, Stepper, tap,
} from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import guest from '../../services/guestService';
import { errorMessage } from '../../services/api';
import useLoad from '../../hooks/useLoad';
import { useLiveEvent } from '../../contexts/LiveContext';
import { addDays, ago, dayLabel, hhmm, isoDay, xaf } from '../../utils/format';

const TABS = [
  { value: 'menu', label: 'Order in', icon: 'restaurant-outline' },
  { value: 'orders', label: 'My orders', icon: 'time-outline' },
  { value: 'table', label: 'Book a table', icon: 'wine-outline' },
];

const nextSlot = () => {
  const d = new Date(Date.now() + 45 * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
};

/**
 * In-residence dining (menu → order charged to the stay), order tracking and table reservations.
 * Orders and tables appear in FAY OS → Dining; status changes come back live.
 */
export default function DiningScreen({ navigation, route }) {
  const [tab, setTab] = useState(route.params?.tab || 'menu');
  const { data, setData, loading, error, refreshing, refresh, reload } = useLoad(async () => {
    const [menu, orders, reservations, overview] = await Promise.all([guest.menu(), guest.orders(), guest.reservations(), guest.overview()]);
    return { menu, orders, reservations, stay: overview.stay };
  });
  useLiveEvent('dining:updated', reload);

  const [cart, setCart] = useState({});
  const [checkout, setCheckout] = useState(null);
  const [table, setTable] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [category, setCategory] = useState('All');

  const menu = data?.menu || [];
  const inHouse = data?.stay?.status === 'checked_in';
  const canReserve = ['checked_in', 'confirmed'].includes(data?.stay?.status);
  const categories = useMemo(() => ['All', ...Array.from(new Set(menu.map((m) => m.category)))], [menu]);
  const venues = useMemo(() => Array.from(new Set(menu.map((m) => m.venue))).filter(Boolean), [menu]);
  const shown = category === 'All' ? menu : menu.filter((m) => m.category === category);
  const items = Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => ({ item: menu.find((m) => String(m.id) === id), qty })).filter((l) => l.item);
  const total = items.reduce((sum, l) => sum + l.item.price * l.qty, 0);
  const count = items.reduce((n, l) => n + l.qty, 0);

  const add = (id, delta) => {
    tap();
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(20, (c[id] || 0) + delta)) }));
  };

  const placeOrder = async () => {
    setBusy(true);
    setFormError('');
    try {
      const order = await guest.placeOrder({
        items: items.map((l) => ({ id: l.item.id, qty: l.qty })),
        time: checkout.asap ? 'asap' : hhmm(checkout.time),
        notes: checkout.notes.trim() || undefined,
      });
      setData((d) => ({ ...d, orders: [order, ...d.orders] }));
      setCart({});
      setCheckout(null);
      setTab('orders');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reserve = async () => {
    setBusy(true);
    setFormError('');
    try {
      const r = await guest.reserveTable({ venue: table.venue, date: isoDay(table.date), time: hhmm(table.time), guests: table.guests, notes: table.notes.trim() || undefined });
      setData((d) => ({ ...d, reservations: [r, ...d.reservations] }));
      setTable(null);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cancelReservation = (r) =>
    Alert.alert('Cancel this table?', `${r.venue} · ${dayLabel(r.date)} ${r.time}`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel table',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await guest.cancelReservation(r.id);
            setData((d) => ({ ...d, reservations: d.reservations.map((x) => (x.id === updated.id ? updated : x)) }));
          } catch (e) {
            Alert.alert('Could not cancel', errorMessage(e));
          }
        },
      },
    ]);

  const footer =
    tab === 'menu' && count > 0 ? (
      <Button title={`Review order · ${count} · ${xaf(total)}`} onPress={() => { setFormError(''); setCheckout({ asap: true, time: nextSlot(), notes: '' }); }} />
    ) : tab === 'table' && canReserve ? (
      <Button
        title="Request a table"
        icon="add"
        onPress={() => {
          setFormError('');
          setTable({ venue: venues[0] || 'Restaurant', date: new Date(), time: (() => { const d = new Date(); d.setHours(19, 30, 0, 0); return d; })(), guests: 2, notes: '' });
        }}
      />
    ) : null;

  return (
    <Screen title="Dining" subtitle={inHouse ? `Delivered to Residence ${data.stay.residence.unit}` : 'Faysha kitchens'} onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh} footer={footer}>
      <View style={{ marginTop: 10, marginBottom: 4 }}>
        <ChipRow options={TABS} value={tab} onChange={setTab} />
      </View>

      {loading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : tab === 'menu' ? (
        <>
          {!inHouse ? <Notice style={{ marginTop: 14 }}>In-residence dining opens once you have checked in. You can browse the menu now.</Notice> : null}
          {categories.length > 2 ? (
            <View style={{ marginTop: 16 }}>
              <ChipRow options={categories} value={category} onChange={setCategory} />
            </View>
          ) : null}
          {!menu.length ? <Empty icon="restaurant-outline" title="The menu is being prepared" text="Ask the concierge for today's dishes." /> : null}
          {shown.map((m) => (
            <View key={m.id} style={s.dish}>
              <View style={{ flex: 1 }}>
                <Text style={s.dishName}>
                  {m.name}
                  {m.popular ? <Text style={s.popular}>  ✦ Popular</Text> : null}
                </Text>
                <Text style={s.dishMeta}>{m.venue} · {m.category}</Text>
                <Text style={s.price}>{xaf(m.price)}</Text>
              </View>
              {inHouse ? (
                cart[m.id] ? (
                  <View style={s.qty}>
                    <TouchableOpacity onPress={() => add(m.id, -1)} style={s.qtyBtn} accessibilityLabel={`Remove one ${m.name}`}>
                      <Ionicons name="remove" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={s.qtyText}>{cart[m.id]}</Text>
                    <TouchableOpacity onPress={() => add(m.id, 1)} style={s.qtyBtn} accessibilityLabel={`Add one ${m.name}`}>
                      <Ionicons name="add" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => add(m.id, 1)} style={s.addBtn} accessibilityLabel={`Add ${m.name}`}>
                    <Ionicons name="add" size={18} color={COLORS.background} />
                  </TouchableOpacity>
                )
              ) : null}
            </View>
          ))}
        </>
      ) : tab === 'orders' ? (
        <>
          {!data.orders.length && !data.reservations.length ? <Empty icon="time-outline" title="No orders yet" text="Your in-residence orders and tables will appear here." /> : null}
          {data.orders.length ? <SectionTitle>ORDERS</SectionTitle> : null}
          {data.orders.map((o) => (
            <Card key={o.id} style={{ marginBottom: 10 }}>
              <View style={s.rowBetween}>
                <Text style={s.cardEyebrow}>{o.number} · {o.venue}</Text>
                <Pill label={o.status} />
              </View>
              <Text style={s.cardTitle}>{o.items}</Text>
              <View style={[s.rowBetween, { marginTop: 10 }]}>
                <Text style={s.meta}>{o.time === 'ASAP' ? 'As soon as possible' : `For ${o.time}`} · {ago(o.createdAt)}</Text>
                <Text style={s.priceSmall}>{xaf(o.total)}</Text>
              </View>
            </Card>
          ))}
          {data.reservations.length ? <SectionTitle>TABLES</SectionTitle> : null}
          {data.reservations.map((r) => <ReservationCard key={r.id} r={r} onCancel={() => cancelReservation(r)} />)}
        </>
      ) : (
        <>
          {!canReserve ? <Notice style={{ marginTop: 14 }}>Table reservations open once your stay is confirmed.</Notice> : null}
          <Body style={{ marginTop: 16 }}>Request a table and the restaurant confirms it — you'll get a notification as soon as it does.</Body>
          {data.reservations.length ? <SectionTitle>YOUR TABLES</SectionTitle> : null}
          {data.reservations.map((r) => <ReservationCard key={r.id} r={r} onCancel={() => cancelReservation(r)} />)}
        </>
      )}

      <Sheet visible={Boolean(checkout)} onClose={() => setCheckout(null)} title="Your order">
        {checkout && (
          <>
            {items.map((l) => (
              <View key={l.item.id} style={s.line}>
                <Text style={s.lineText}>{l.qty}× {l.item.name}</Text>
                <Text style={s.lineText}>{xaf(l.item.price * l.qty)}</Text>
              </View>
            ))}
            <View style={[s.line, { borderBottomWidth: 0, marginBottom: 10 }]}>
              <Text style={[s.lineText, { color: COLORS.primary }]}>Total, charged to your stay</Text>
              <Text style={[s.lineText, { color: COLORS.primary }]}>{xaf(total)}</Text>
            </View>
            <ChipRow scroll={false} options={[{ value: 'asap', label: 'As soon as possible' }, { value: 'later', label: 'Choose a time' }]} value={checkout.asap ? 'asap' : 'later'} onChange={(v) => setCheckout({ ...checkout, asap: v === 'asap' })} />
            <View style={{ height: 14 }} />
            {!checkout.asap ? <PickerField label="Deliver at" mode="time" value={checkout.time} onChange={(time) => setCheckout({ ...checkout, time })} /> : null}
            <Field label="Notes for the kitchen" value={checkout.notes} onChangeText={(notes) => setCheckout({ ...checkout, notes })} placeholder="Allergies, no onions, extra cutlery…" multiline maxLength={200} />
            {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{formError}</Notice> : null}
            <Button title="Place order" onPress={placeOrder} loading={busy} />
          </>
        )}
      </Sheet>

      <Sheet visible={Boolean(table)} onClose={() => setTable(null)} title="Request a table">
        {table && (
          <>
            {venues.length > 1 ? (
              <>
                <ChipRow options={venues} value={table.venue} onChange={(venue) => setTable({ ...table, venue })} />
                <View style={{ height: 14 }} />
              </>
            ) : null}
            <PickerField label="Date" value={table.date} minimumDate={new Date()} maximumDate={addDays(new Date(), 90)} onChange={(date) => setTable({ ...table, date })} />
            <PickerField label="Time" mode="time" value={table.time} onChange={(time) => setTable({ ...table, time })} />
            <Stepper label="Guests" value={table.guests} min={1} max={20} onChange={(guests) => setTable({ ...table, guests })} />
            <Field label="Occasion or requests" value={table.notes} onChangeText={(notes) => setTable({ ...table, notes })} placeholder="Anniversary, window table…" multiline maxLength={300} />
            {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{formError}</Notice> : null}
            <Button title="Send request" onPress={reserve} loading={busy} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function ReservationCard({ r, onCancel }) {
  const cancellable = ['pending', 'confirmed'].includes(r.status);
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={s.rowBetween}>
        <Text style={s.cardEyebrow}>{r.number}</Text>
        <Pill label={r.status === 'pending' ? 'Awaiting confirmation' : r.status} />
      </View>
      <Text style={s.cardTitle}>{r.venue}</Text>
      <Text style={s.meta}>{dayLabel(r.date, { weekday: true })} · {r.time} · {r.guests} guest{r.guests > 1 ? 's' : ''}</Text>
      {cancellable ? <Text style={s.cancel} onPress={onCancel}>Cancel</Text> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  dish: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dishName: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 14.5 },
  popular: { color: COLORS.primary, fontSize: 11 },
  dishMeta: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 11.5, marginTop: 3 },
  price: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13, marginTop: 6 },
  priceSmall: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13 },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  qty: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderGold, borderRadius: 999 },
  qtyBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: COLORS.text, fontFamily: FONTS.body, minWidth: 18, textAlign: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase' },
  cardTitle: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 14.5, marginTop: 8, lineHeight: 20 },
  meta: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 4 },
  cancel: { fontFamily: FONTS.body, color: '#ff8a80', fontSize: 12, marginTop: 10, alignSelf: 'flex-end' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  lineText: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 13.5, flexShrink: 1 },
});
