import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, Button, Field, Notice, Body, Checkbox } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

const strongEnough = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

/** Create a guest account (POST /api/auth/register). Earlier bookings made with the same email join the account. */
export default function SignUpScreen({ navigation }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exists, setExists] = useState(false);
  const set = (k) => (v) => {
    setForm({ ...form, [k]: v });
    setError('');
    setExists(false);
  };

  const submit = async () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setError('Please fill in your name, email and a password');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    if (!strongEnough(form.password)) {
      setError('Use at least 8 characters, with letters and a number');
      return;
    }
    if (!agree) {
      setError('Please accept the terms and privacy policy');
      return;
    }
    setBusy(true);
    const result = await register(form);
    if (!result.success) {
      setError(result.error);
      setExists(result.code === 'ACCOUNT_EXISTS');
      setBusy(false);
    }
  };

  return (
    <Screen onBack={() => navigation.goBack()}>
      <Text style={s.title}>Create your account</Text>
      <Body muted style={{ marginBottom: 26 }}>Your stays, digital key, smart home and concierge — all in one place.</Body>
      {error ? (
        <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 16 }}>
          {error}
        </Notice>
      ) : null}
      {exists ? <Button title="Sign in instead" variant="ghost" small onPress={() => navigation.replace('Login', { email: form.email.trim() })} style={{ marginBottom: 16 }} /> : null}
      <Field label="Full name" value={form.fullName} onChangeText={set('fullName')} autoComplete="name" textContentType="name" placeholder="As on your ID" />
      <Field label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" />
      <Field label="Phone (optional)" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" placeholder="+237 6XX XXX XXX" />
      <Field
        label="Password"
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        hint="At least 8 characters, with letters and a number"
      />
      <Checkbox checked={agree} onChange={setAgree}>
        I accept the <Text style={s.link} onPress={() => navigation.navigate('Terms')}>Terms of Service</Text> and the{' '}
        <Text style={s.link} onPress={() => navigation.navigate('Privacy')}>Privacy Policy</Text>.
      </Checkbox>
      <Button title="Create account" onPress={submit} loading={busy} style={{ marginTop: 18 }} />
      <View style={s.footer}>
        <Body muted>Already a guest?</Body>
        <Text style={s.link} onPress={() => navigation.replace('Login')}>Sign in</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.text, marginTop: 24, marginBottom: 8, letterSpacing: 0.6 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 22, marginBottom: 20 },
  link: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13, lineHeight: 19.5 },
});
