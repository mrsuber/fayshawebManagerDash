import React from 'react';
import LegalScreen from './LegalScreen';

/** The published Privacy Policy (FAY OS → Content → Terms & privacy). */
export default function PrivacyScreen({ navigation }) {
  return <LegalScreen slug="privacy" kicker="Your data" navigation={navigation} />;
}
