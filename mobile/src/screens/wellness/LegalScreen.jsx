import React from 'react';
import { Text } from 'react-native';
import Markdown from '../../components/Markdown';
import { Body, ErrorView, Eyebrow, Heading, Loading, Screen } from '../../components/ui';
import { COLORS, FONTS } from '../../constants/theme';
import useLoad from '../../hooks/useLoad';
import apiClient from '../../services/api';

const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Terms of service or privacy policy, as published in FAY OS → Content (the same text as the website). */
export default function LegalScreen({ slug, kicker, navigation }) {
  const { data, loading, error, reload, refreshing, refresh } = useLoad(() => apiClient.get(`/content/legal/${slug}`), { focus: false });
  const onBack = navigation?.canGoBack?.() ? () => navigation.goBack() : undefined;
  if (loading) return <Screen title={kicker} onBack={onBack}><Loading /></Screen>;
  if (error && !data) return <Screen title={kicker} onBack={onBack}><ErrorView message={error} onRetry={reload} /></Screen>;
  return (
    <Screen title={kicker} onBack={onBack} refreshing={refreshing} onRefresh={refresh}>
      <Eyebrow style={{ marginTop: 18 }}>{kicker}</Eyebrow>
      <Heading size={28}>{data.title}</Heading>
      <Text style={{ fontFamily: FONTS.body, color: COLORS.textTertiary, fontSize: 12.5, marginTop: 8, marginBottom: 18 }}>
        Version {data.version} · in effect from {longDate(data.effectiveDate)}
      </Text>
      <Markdown source={data.body} />
      <Body muted style={{ marginTop: 18, fontSize: 12 }}>Faysha Wellness Residence · Cameroon</Body>
    </Screen>
  );
}
