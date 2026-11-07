import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Button, Notice, Body } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';
import { errorMessage } from '../../services/api';

const LENGTH = 6;

/**
 * Sign-up verification: the 6-digit code emailed to the guest. Entering it signs them in (the app then opens
 * Home by itself). Unverified accounts cannot sign in, so sign-in also lands here.
 */
export default function EmailVerificationScreen({ route, navigation }) {
  const { verifyCode } = useAuth();
  const email = route.params?.email || '';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [wait, setWait] = useState(route.params?.waitSeconds ?? 60);
  const input = useRef(null);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (value = code) => {
    if (value.length !== LENGTH) {
      setError('Enter the 6 digits from your email');
      return;
    }
    setBusy(true);
    setError('');
    const result = await verifyCode(email, value);
    // On success the navigator swaps to the signed-in app by itself.
    if (!result.success) {
      setBusy(false);
      setError(result.error);
      if (result.code === 'ALREADY_VERIFIED') navigation.replace('Login', { email });
      if (['LOCKED', 'EXPIRED'].includes(result.code)) setCode('');
    }
  };

  const onChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    setError('');
    if (digits.length === LENGTH) submit(digits);
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      const r = await authService.resendCode(email);
      setWait(r.waitSeconds || 60);
      setCode('');
      setInfo(`A new code is on its way to ${email}.`);
    } catch (e) {
      if (e.waitSeconds) setWait(e.waitSeconds);
      setError(errorMessage(e, 'We could not send a new code.'));
    }
  };

  return (
    <Screen onBack={() => navigation.goBack()}>
      <View style={s.badge}>
        <Ionicons name="mail-open-outline" size={30} color={COLORS.primary} />
      </View>
      <Text style={s.title}>Check your email</Text>
      <Body muted style={{ marginBottom: 26 }}>
        {route.params?.fromLogin ? 'Your account is not verified yet. ' : ''}We sent a 6-digit code to{' '}
        <Text style={s.email}>{email}</Text>. Enter it to open your account.
      </Body>

      {error ? <Notice tone="red" icon="alert-circle-outline" style={{ marginBottom: 16 }}>{error}</Notice> : null}
      {info ? <Notice tone="green" icon="checkmark-circle-outline" style={{ marginBottom: 16 }}>{info}</Notice> : null}

      <Pressable onPress={() => input.current?.focus()} style={s.boxes} accessibilityLabel="Verification code">
        {Array.from({ length: LENGTH }).map((_, i) => {
          const active = i === Math.min(code.length, LENGTH - 1);
          return (
            <View key={i} style={[s.box, code[i] && s.boxFilled, active && s.boxActive]}>
              <Text style={s.digit}>{code[i] || ''}</Text>
            </View>
          );
        })}
        <TextInput
          ref={input}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          autoFocus
          style={s.hidden}
          caretHidden
        />
      </Pressable>

      <Button title="Verify and continue" onPress={() => submit()} loading={busy} disabled={code.length !== LENGTH} style={{ marginTop: 26 }} />

      <View style={s.footer}>
        <Body muted>Didn’t get it? Check spam, or</Body>
        {wait > 0 ? (
          <Text style={s.dim}>send again in {wait}s</Text>
        ) : (
          <Text style={s.link} onPress={resend}>send a new code</Text>
        )}
      </View>
      <Text style={[s.link, { textAlign: 'center' }]} onPress={() => navigation.replace('SignUp')}>Use a different email</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  badge: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: COLORS.borderGold, backgroundColor: 'rgba(200,164,93,0.08)', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  title: { fontFamily: FONTS.heading, fontSize: 28, color: COLORS.text, marginTop: 18, marginBottom: 8, letterSpacing: 0.6 },
  email: { color: COLORS.primary, fontFamily: FONTS.body },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, aspectRatio: 0.82, maxWidth: 54, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.backgroundCard, alignItems: 'center', justifyContent: 'center' },
  boxFilled: { borderColor: COLORS.borderGold },
  boxActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(200,164,93,0.08)' },
  digit: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.text },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 22, marginBottom: 12 },
  link: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 13, lineHeight: 19.5 },
  dim: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 13, lineHeight: 19.5 },
});
