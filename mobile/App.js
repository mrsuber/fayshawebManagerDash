import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Cinzel_400Regular } from '@expo-google-fonts/cinzel/400Regular';
import { Cinzel_600SemiBold } from '@expo-google-fonts/cinzel/600SemiBold';
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular';
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/contexts/AuthContext';
import { LiveProvider } from './src/contexts/LiveContext';
import { STRIPE_PUBLISHABLE_KEY } from './src/config';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // The theme refers to the families as "Cinzel" and "Montserrat" (constants/theme.js).
  const [fontsLoaded, fontError] = useFonts({
    Cinzel: Cinzel_400Regular,
    'Cinzel-SemiBold': Cinzel_600SemiBold,
    Montserrat: Montserrat_400Regular,
    'Montserrat-Medium': Montserrat_500Medium,
    'Montserrat-SemiBold': Montserrat_600SemiBold,
  });
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    // Hand over from the native splash to the animated one as soon as the first frame can render.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} urlScheme="faysha" merchantIdentifier="merchant.com.fayshaa.app">
        <AuthProvider>
          <LiveProvider>
            <StatusBar style="light" />
            <AppNavigator ready={ready} />
          </LiveProvider>
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
