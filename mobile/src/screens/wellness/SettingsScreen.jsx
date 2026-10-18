import React, { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Screen, Card, ListRow, SectionTitle, Sheet, Field, Notice, Button, Body } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import apiClient, { errorMessage } from '../../services/api';
import { registerForPush, unregisterPush } from '../../services/push';
import { APP } from '../../config';

const PUSH_PREF = 'faysha.pushEnabled';
const EMERGENCY = '+237 653 255 547';
const CONCIERGE = '+237 651 841 003';

/** Real settings: notifications on this device, account, legal, help — and closing the account. */
export default function SettingsScreen({ navigation }) {
  const { logout } = useAuth();
  const [push, setPush] = useState(true);
  const [permission, setPermission] = useState('undetermined');
  const [closing, setClosing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setPush((await AsyncStorage.getItem(PUSH_PREF)) !== 'off');
        try {
          setPermission((await Notifications.getPermissionsAsync()).status);
        } catch {
          setPermission('undetermined');
        }
      })();
    }, []),
  );

  const togglePush = async (on) => {
    setPush(on);
    await AsyncStorage.setItem(PUSH_PREF, on ? 'on' : 'off');
    if (on) {
      const token = await registerForPush();
      const status = (await Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' }))).status;
      setPermission(status);
      if (!token && status === 'denied') {
        Alert.alert('Notifications are off', 'Allow notifications for Faysha in your phone settings to hear from your hosts.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ]);
      }
    } else {
      await unregisterPush();
    }
  };

  const closeAccount = async () => {
    if (!closing.password) {
      setError('Enter your password to confirm');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/guest/account/delete', { password: closing.password });
      setClosing(null);
      await logout();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Settings" onBack={() => navigation.goBack()}>
      <SectionTitle>NOTIFICATIONS</SectionTitle>
      <Card>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Updates from your hosts</Text>
            <Body muted style={{ fontSize: 12 }}>Request progress, dining, rides, messages and booking confirmations on this phone</Body>
          </View>
          <Switch value={push} onValueChange={togglePush} trackColor={{ true: COLORS.primary, false: 'rgba(242,233,216,0.15)' }} thumbColor={COLORS.text}
          activeThumbColor={COLORS.text} />
        </View>
        {push && permission === 'denied' ? (
          <Notice style={{ marginTop: 12 }} icon="notifications-off-outline">
            Notifications are blocked in your phone settings. <Text style={s.link} onPress={() => Linking.openSettings()}>Open settings</Text>
          </Notice>
        ) : null}
      </Card>

      <SectionTitle>ACCOUNT</SectionTitle>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow icon="person-outline" title="Personal details" onPress={() => navigation.navigate('PersonalDetails')} />
        <ListRow icon="key-outline" title="Change password" onPress={() => navigation.navigate('ChangePassword')} last />
      </Card>

      <SectionTitle>HELP</SectionTitle>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow icon="chatbubble-ellipses-outline" title="Message the concierge" onPress={() => navigation.navigate('Main', { screen: 'Concierge' })} />
        <ListRow icon="call-outline" title="Call the concierge" subtitle={CONCIERGE} onPress={() => Linking.openURL(`tel:${CONCIERGE.replace(/\s/g, '')}`)} />
        <ListRow icon="medkit-outline" title="Emergency line" subtitle={EMERGENCY} onPress={() => Linking.openURL(`tel:${EMERGENCY.replace(/\s/g, '')}`)} />
        <ListRow icon="mail-outline" title="Email us" subtitle={APP.supportEmail} onPress={() => Linking.openURL(`mailto:${APP.supportEmail}`)} last />
      </Card>

      <SectionTitle>LEGAL</SectionTitle>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow icon="document-text-outline" title="Terms of service" onPress={() => navigation.navigate('Terms')} />
        <ListRow icon="lock-closed-outline" title="Privacy policy" onPress={() => navigation.navigate('Privacy')} />
        <ListRow icon="globe-outline" title="fayshaa.com" onPress={() => Linking.openURL(APP.website)} last />
      </Card>

      <Button title="Close my account" variant="danger" onPress={() => { setError(''); setClosing({ password: '' }); }} style={{ marginTop: 30 }} />
      <Text style={s.version}>Faysha · v{APP.version}</Text>

      <Sheet visible={Boolean(closing)} onClose={() => setClosing(null)} title="Close your account">
        {closing && (
          <>
            <Body style={{ marginBottom: 16 }}>
              Your account and personal details are removed and you are signed out on every device. Records of past stays and payments are kept, as the law requires, without your account. This can't be undone.
            </Body>
            <Field label="Password" value={closing.password} onChangeText={(password) => setClosing({ password })} secureTextEntry autoCapitalize="none" />
            {error ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 12 }}>{error}</Notice> : null}
            <Button title="Close account" variant="danger" onPress={closeAccount} loading={busy} />
            <Button title="Keep my account" variant="ghost" onPress={() => setClosing(null)} style={{ marginTop: 10 }} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  label: { fontFamily: FONTS.body, color: COLORS.text, fontSize: 14, marginBottom: 2 },
  link: { color: COLORS.primary },
  version: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 11.5, textAlign: 'center', marginTop: 18 },
});
