import React, { useRef, useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Loading, ErrorView, SectionTitle, Notice, Body, Button, tap } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import guest from '../../services/guestService';
import { errorMessage } from '../../services/api';
import useLoad from '../../hooks/useLoad';

const ICONS = {
  lightbulb: 'bulb-outline',
  blinds: 'reorder-four-outline',
  tv: 'tv-outline',
  air: 'leaf-outline',
  kitchen: 'snow-outline',
  coffee_maker: 'cafe-outline',
  pool: 'water-outline',
  light: 'flashlight-outline',
  umbrella: 'umbrella-outline',
};

const SCENES = {
  welcome: { icon: 'sunny-outline', label: 'Welcome' },
  relax: { icon: 'leaf-outline', label: 'Relax' },
  sleep: { icon: 'moon-outline', label: 'Sleep' },
  away: { icon: 'walk-outline', label: 'Away' },
  'wake up': { icon: 'partly-sunny-outline', label: 'Wake up' },
};

/** The residence's climate, scenes, devices and privacy — the same controls staff see in FAY OS → Residences. */
export default function SmartHomeScreen({ navigation }) {
  const { data, setData, loading, error, refreshing, refresh, reload } = useLoad(() => guest.home(), { focus: false });
  const [failure, setFailure] = useState('');
  const pendingTemp = useRef(null);

  /** Optimistic change: show it at once, then take the server's state (or roll back). */
  const change = async (optimistic, request) => {
    const before = data;
    setFailure('');
    setData(optimistic(before));
    try {
      setData(await request());
    } catch (e) {
      setData(before);
      setFailure(errorMessage(e));
    }
  };

  const nudgeTemp = (delta) => {
    tap();
    const next = Math.max(16, Math.min(30, data.targetTemp + delta));
    setData({ ...data, targetTemp: next });
    clearTimeout(pendingTemp.current);
    // Send once the guest stops tapping.
    pendingTemp.current = setTimeout(async () => {
      try {
        setData(await guest.setClimate(next));
      } catch (e) {
        setFailure(errorMessage(e));
        reload();
      }
    }, 600);
  };

  if (loading) return <Screen title="Smart home" onBack={() => navigation.goBack()}><Loading /></Screen>;
  if (error && !data) {
    return (
      <Screen title="Smart home" onBack={() => navigation.goBack()}>
        <ErrorView message={error} onRetry={reload} />
        <Button title="Ask the concierge" variant="ghost" onPress={() => navigation.navigate('Main', { screen: 'Concierge' })} />
      </Screen>
    );
  }

  return (
    <Screen title="Smart home" subtitle={`${data.residence.name} · Residence ${data.residence.unit}`} onBack={() => navigation.goBack()} refreshing={refreshing} onRefresh={refresh}>
      {failure ? <Notice tone="red" icon="alert-circle-outline" style={{ marginTop: 12 }}>{failure}</Notice> : null}

      <LinearGradient colors={['rgba(200,164,93,0.18)', 'rgba(200,164,93,0.04)']} style={s.climate}>
        <Text style={s.climateLabel}>CLIMATE</Text>
        <View style={s.climateRow}>
          <TouchableOpacity style={s.round} onPress={() => nudgeTemp(-1)} disabled={data.targetTemp <= 16} accessibilityLabel="Cooler">
            <Ionicons name="remove" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.temp}>{data.targetTemp}°</Text>
            <Text style={s.tempSub}>{data.targetTemp <= 20 ? 'Cool' : data.targetTemp <= 24 ? 'Comfortable' : 'Warm'}</Text>
          </View>
          <TouchableOpacity style={s.round} onPress={() => nudgeTemp(1)} disabled={data.targetTemp >= 30} accessibilityLabel="Warmer">
            <Ionicons name="add" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <SectionTitle>SCENES</SectionTitle>
      <View style={s.scenes}>
        {data.scenes.map((key) => {
          const scene = SCENES[key] || { icon: 'color-wand-outline', label: key };
          const active = data.scene === key;
          return (
            <TouchableOpacity
              key={key}
              style={[s.scene, active && s.sceneActive]}
              activeOpacity={0.85}
              onPress={() => { tap(); change((d) => ({ ...d, scene: key }), () => guest.setScene(key)); }}
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={scene.icon} size={20} color={active ? COLORS.background : COLORS.primary} />
              <Text style={[s.sceneText, active && { color: COLORS.background }]}>{scene.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Card style={[s.privacy, { marginTop: 18 }]}>
        <Ionicons name="hand-left-outline" size={20} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.deviceName}>Do not disturb</Text>
          <Body muted style={{ fontSize: 12 }}>Housekeeping and staff won't knock</Body>
        </View>
        <Switch
          value={data.doNotDisturb}
          onValueChange={(on) => change((d) => ({ ...d, doNotDisturb: on }), () => guest.setPrivacy(on))}
          trackColor={{ true: COLORS.primary, false: 'rgba(242,233,216,0.15)' }}
          thumbColor={COLORS.text}
          activeThumbColor={COLORS.text}
        />
      </Card>
      <Card style={[s.privacy, { marginTop: 10 }]}>
        <Ionicons name={data.frontDoor === 'Secured' ? 'lock-closed-outline' : 'lock-open-outline'} size={20} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.deviceName}>Front door · {data.frontDoor}</Text>
          <Body muted style={{ fontSize: 12 }}>Open it with your digital key</Body>
        </View>
        <Text style={s.link} onPress={() => navigation.navigate('DigitalKey')}>Key</Text>
      </Card>

      {data.rooms.map((room) => (
        <View key={room.name}>
          <SectionTitle>{room.name.toUpperCase()}</SectionTitle>
          <View style={s.devices}>
            {room.devices.map((d) => (
              <TouchableOpacity
                key={d.key}
                style={[s.device, d.on && s.deviceOn]}
                activeOpacity={0.85}
                onPress={() => {
                  tap();
                  change(
                    (h) => ({ ...h, rooms: h.rooms.map((r) => ({ ...r, devices: r.devices.map((x) => (x.key === d.key ? { ...x, on: !d.on } : x)) })) }),
                    () => guest.setDevice(d.key, !d.on),
                  );
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: d.on }}
                accessibilityLabel={`${room.name} ${d.label}`}
              >
                <Ionicons name={ICONS[d.icon] || 'radio-button-on-outline'} size={20} color={d.on ? COLORS.primary : COLORS.textTertiary} />
                <Text style={[s.deviceName, !d.on && { color: COLORS.textTertiary }]}>{d.label}</Text>
                <Text style={[s.deviceState, d.on && { color: COLORS.primary }]}>{d.on ? 'On' : 'Off'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  climate: { marginTop: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderGold, padding: 20 },
  climateLabel: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 10.5, letterSpacing: 2, textAlign: 'center' },
  climateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  round: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: COLORS.borderGold, alignItems: 'center', justifyContent: 'center' },
  temp: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 58, letterSpacing: 1 },
  tempSub: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 12, letterSpacing: 1 },
  scenes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scene: { width: '31.5%', alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: 'rgba(200,164,93,0.05)' },
  sceneActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sceneText: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 12 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  link: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13 },
  devices: { flexDirection: 'row', gap: 8 },
  device: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8, backgroundColor: 'rgba(242,233,216,0.02)' },
  deviceOn: { borderColor: COLORS.borderGold, backgroundColor: 'rgba(200,164,93,0.08)' },
  deviceName: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 13 },
  deviceState: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 11 },
});
