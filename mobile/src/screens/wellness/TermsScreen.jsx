import React from 'react';
import LegalScreen from './LegalScreen';

/** The published Terms of Service (FAY OS → Content → Terms & privacy). */
export default function TermsScreen({ navigation }) {
  return <LegalScreen slug="terms" kicker="Terms of stay" navigation={navigation} />;
}
