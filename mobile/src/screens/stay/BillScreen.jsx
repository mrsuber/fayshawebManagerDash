import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, Card, Loading, ErrorView, Empty, SectionTitle, Pill, Notice, Button } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import guest from '../../services/guestService';
import useLoad from '../../hooks/useLoad';
import { dayLabel, stayRange, xaf } from '../../utils/format';

const METHOD = { stripe: 'Card', card: 'Card', mobile_money: 'Mobile money', cash: 'Cash', bank_transfer: 'Bank transfer' };

/** The stay's bill: the stay itself plus dining, experiences and other charges, and the payments made. */
export default function BillScreen({ navigation, route }) {
  const stayId = route.params?.stayId;
  const { data, loading, error, refreshing, refresh, reload } = useLoad(() => guest.folio(stayId));

  return (
    <Screen title="My bill" subtitle={data?.stay ? `${data.stay.residence.name} · ${stayRange(data.stay.checkIn, data.stay.checkOut)}` : undefined} onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh}>
      {loading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !data ? (
        <Empty icon="receipt-outline" title="No bill yet" text="Your bill appears here once you have a stay with us." />
      ) : (
        <>
          <Card highlight style={{ marginTop: 14 }}>
            <Text style={s.label}>{data.balance > 0 ? 'BALANCE TO SETTLE' : 'ALL SETTLED'}</Text>
            <Text style={s.big}>{xaf(data.balance)}</Text>
            <View style={s.row}>
              <Text style={s.small}>Total {xaf(data.total)}</Text>
              <Text style={s.small}>Paid {xaf(data.paid)}</Text>
            </View>
          </Card>
          {data.balance > 0 && data.stay.status !== 'pending' ? (
            <Notice style={{ marginTop: 12 }}>Extras are settled at the front desk or with the concierge before you leave — by card, mobile money or cash.</Notice>
          ) : null}

          <SectionTitle>CHARGES</SectionTitle>
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {data.lines.map((l, i) => (
              <View key={l.id} style={[s.line, i < data.lines.length - 1 && s.border]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.desc}>{l.description}</Text>
                  <Text style={s.small}>{l.category} · {dayLabel(l.at ? new Date(l.at) : null)}</Text>
                </View>
                <Text style={s.amount}>{xaf(l.amount)}</Text>
              </View>
            ))}
          </Card>

          {data.payments.length ? (
            <>
              <SectionTitle>PAYMENTS</SectionTitle>
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {data.payments.map((p, i) => (
                  <View key={p.id} style={[s.line, i < data.payments.length - 1 && s.border]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.desc}>{METHOD[p.method] || p.method}</Text>
                      <Text style={s.small}>{dayLabel(p.at ? new Date(p.at) : null)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={s.amount}>{xaf(p.amount)}</Text>
                      {p.status !== 'completed' ? <Pill label={p.status === 'pending' ? 'Awaiting' : p.status} /> : null}
                    </View>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
          <Button title="Questions about your bill?" variant="ghost" icon="chatbubble-ellipses-outline" onPress={() => navigation.navigate('Main', { screen: 'Concierge' })} style={{ marginTop: 22 }} />
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 10.5, letterSpacing: 2 },
  big: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 32, marginTop: 6, letterSpacing: 0.6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  small: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  desc: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 13.5 },
  amount: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 13.5 },
});
