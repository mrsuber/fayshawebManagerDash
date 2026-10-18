import React, { useState } from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Loading, ErrorView, Empty, ChipRow, Pill, Button } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import guest from '../../services/guestService';
import useLoad from '../../hooks/useLoad';
import { fileUrl } from '../../config';
import { stayRange, xaf } from '../../utils/format';

export const STAY_STATUS = { checked_in: 'In residence', confirmed: 'Confirmed', pending: 'Awaiting payment', checked_out: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };

/** Every booking of the guest (also those made on the website with the same email before the account existed). */
export default function MyStaysScreen({ navigation }) {
  const { data, loading, error, refreshing, refresh, reload } = useLoad(() => guest.stays());
  const [tab, setTab] = useState('upcoming');
  const stays = data || [];
  const upcoming = stays.filter((s) => ['pending', 'confirmed', 'checked_in'].includes(s.status)).reverse();
  const past = stays.filter((s) => !upcoming.includes(s));
  const shown = tab === 'upcoming' ? upcoming : past;

  return (
    <Screen title="My stays" onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh}>
      <View style={{ marginTop: 10, marginBottom: 10 }}>
        <ChipRow options={[{ value: 'upcoming', label: `Upcoming${upcoming.length ? ` · ${upcoming.length}` : ''}` }, { value: 'past', label: 'Past' }]} value={tab} onChange={setTab} />
      </View>
      {loading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !shown.length ? (
        <>
          <Empty icon="bed-outline" title={tab === 'upcoming' ? 'No upcoming stays' : 'No past stays yet'} text={tab === 'upcoming' ? 'Your next escape is a few taps away.' : 'Your stays with us will be remembered here.'} />
          {tab === 'upcoming' ? <Button title="Book a stay" icon="calendar-outline" onPress={() => navigation.navigate('BookStay')} /> : null}
        </>
      ) : (
        shown.map((stay) => (
          <TouchableOpacity key={stay.id} activeOpacity={0.9} onPress={() => navigation.navigate('StayDetail', { id: stay.id })} style={{ marginBottom: 14 }}>
            <ImageBackground source={stay.residence.image ? { uri: fileUrl(stay.residence.image) } : require('../../../assets/sunset.jpg')} style={s.card} imageStyle={{ borderRadius: 16 }}>
              <LinearGradient colors={['rgba(13,13,13,0.05)', 'rgba(13,13,13,0.93)']} style={s.shade}>
                <Pill label={STAY_STATUS[stay.status] || stay.status} />
                <View>
                  <Text style={s.name}>{stay.residence.name}</Text>
                  <Text style={s.meta}>{stayRange(stay.checkIn, stay.checkOut)} · {stay.nights} night{stay.nights === 1 ? '' : 's'} · {stay.guests} guest{stay.guests === 1 ? '' : 's'}</Text>
                  <Text style={s.meta}>{stay.number} · {xaf(stay.total)}</Text>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { height: 170, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderLight },
  shade: { flex: 1, padding: 16, justifyContent: 'space-between', borderRadius: 16 },
  name: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 19, letterSpacing: 0.6 },
  meta: { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
});
