import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Button, Field, Notice, Body } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

/** Sign in. A temporary password (from a booking email) leads straight to choosing a new one. */
export default function LoginScreen({ navigation, route }) {
  const { login } = useAuth();
  const [email, setEmail] = useState(route.params?.email || '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    setBusy(true);
    setError('');
    const result = await login(email.trim(), password);
    // On success the app switches to the signed-in screens by itself.
    if (!result.success) {
      setError(result.status === 401 ? 'That email and password don’t match. Try again or reset your password.' : result.error);
      setBusy(false);
    }
  };

  return (
    <Screen onBack={() => navigation.goBack()}>
      <Text style={s.title}>Welcome back</Text>
      <Body muted style={{ marginBottom: 28 }}>Sign in to your stay, your residence and your concierge.</Body>
      {error ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 16 }}>{error}</Notice> : null}
      <Field label="Email" value={email} onChangeText={(t) => { setEmail(t); setError(''); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="username" placeholder="you@example.com" />
      <View>
        <Field
          label="Password"
          value={password}
          onChangeText={(t) => { setPassword(t); setError(''); }}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          placeholder="Your password"
          onSubmitEditing={submit}
          returnKeyType="go"
          inputStyle={{ paddingRight: 48 }}
        />
        <TouchableOpacity style={s.eye} onPress={() => setShow(!show)} accessibilityLabel={show ? 'Hide password' : 'Show password'} hitSlop={8}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>
      <Text style={s.forgot} onPress={() => navigation.navigate('ForgotPassword')}>Forgot password?</Text>
      <Button title="Sign in" onPress={submit} loading={busy} style={{ marginTop: 22 }} />
      <View style={s.footer}>
        <Body muted>New to Faysha?</Body>
        <Text style={s.link} onPress={() => navigation.replace('SignUp')}>Create an account</Text>
      </View>
      <Notice style={{ marginTop: 24 }} icon="mail-outline">Booked on our website? Your account was created with your booking — use the email and temporary password we sent you.</Notice>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: FONTS.heading, fontSize: 30, color: COLORS.text, marginTop: 24, marginBottom: 8, letterSpacing: 0.6 },
  eye: { position: 'absolute', right: 14, top: 38 },
  forgot: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13, alignSelf: 'flex-end', marginTop: -2 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 22 },
  link: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13, lineHeight: 19.5 },
});
