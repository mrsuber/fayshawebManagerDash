import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Empty, ErrorView, Field, Heading, Loading, Notice, Screen } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import useLoad from '../../hooks/useLoad';
import apiClient, { errorMessage } from '../../services/api';

function Stars({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }} accessibilityRole="adjustable" accessibilityLabel={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={30} color={COLORS.primary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Rate the team: each recent service (a request, a meal, equipment, the stay) once. Low scores reach a manager at once. */
export default function RateScreen({ navigation }) {
  const { data, loading, error, reload } = useLoad(() => apiClient.get('/guest/ratings/pending'));
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState({});
  const [formError, setFormError] = useState('');

  const send = async (item) => {
    const key = `${item.context}:${item.contextId}`;
    const d = draft[key] || {};
    setBusy(key);
    setFormError('');
    try {
      await apiClient.post('/guest/ratings', { context: item.context, contextId: item.contextId, rating: d.rating, comment: d.comment?.trim() || undefined });
      setDone((x) => ({ ...x, [key]: d.rating }));
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Screen title="Rate your experience" onBack={() => navigation.goBack()}><Loading /></Screen>;
  if (error && !data) return <Screen title="Rate your experience" onBack={() => navigation.goBack()}><ErrorView message={error} onRetry={reload} /></Screen>;
  return (
    <Screen title="Rate your experience" onBack={() => navigation.goBack()}>
      <Heading size={22} style={{ marginTop: 12 }}>How did we do?</Heading>
      <Body muted style={{ marginTop: 6 }}>Your ratings go straight to the residence manager and help us thank the people who looked after you.</Body>
      {!data?.length ? <Empty icon="star-outline" title="Nothing to rate right now" text="After a request, a meal or your stay, you can tell us how it went here." /> : null}
      {formError ? <Notice tone="red" icon="alert-circle-outline" style={{ marginTop: 12 }}>{formError}</Notice> : null}
      {(data || []).map((item) => {
        const key = `${item.context}:${item.contextId}`;
        const d = draft[key] || { rating: 0, comment: '' };
        if (done[key]) {
          return (
            <Card key={key} style={{ marginTop: 12 }}>
              <Text style={s.label}>{item.label.toUpperCase()}</Text>
              <Text style={s.title}>{item.title}</Text>
              <Text style={[s.meta, { color: COLORS.primary }]}>Thank you — {'★'.repeat(done[key])}</Text>
            </Card>
          );
        }
        return (
          <Card key={key} style={{ marginTop: 12 }}>
            <Text style={s.label}>{item.label.toUpperCase()}</Text>
            <Text style={s.title}>{item.title}</Text>
            {item.staff ? <Text style={s.meta}>Looked after by {item.staff}</Text> : null}
            <Stars value={d.rating} onChange={(rating) => setDraft((x) => ({ ...x, [key]: { ...d, rating } }))} />
            {d.rating ? (
              <>
                <Field
                  label={d.rating <= 3 ? 'What could we have done better?' : 'Anything you would like to share? (optional)'}
                  value={d.comment}
                  onChangeText={(comment) => setDraft((x) => ({ ...x, [key]: { ...d, comment } }))}
                  multiline
                  maxLength={1000}
                  style={{ marginTop: 12 }}
                />
                <Button title="Send" small onPress={() => send(item)} loading={busy === key} />
              </>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: FONTS.body, color: COLORS.primary, fontSize: 10.5, letterSpacing: 1.6 },
  title: { fontFamily: FONTS.heading, color: COLORS.text, fontSize: 17, marginTop: 6 },
  meta: { fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12.5, marginTop: 5 },
});
