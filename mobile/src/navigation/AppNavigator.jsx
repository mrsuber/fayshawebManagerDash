import React, { useEffect, useState } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useLive } from '../contexts/LiveContext';
import { navigationRef } from './navigationRef';

import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import BookStayScreen from '../screens/booking/BookStayScreen';

// Signed in: tabs
import HomeScreen from '../screens/wellness/HomeScreen';
import WellnessScreen from '../screens/wellness/WellnessScreen';
import ResidenceScreen from '../screens/stay/ResidenceScreen';
import ConciergeScreen from '../screens/wellness/ConciergeScreen';
import ProfileScreen from '../screens/wellness/ProfileScreen';

// Signed in: the residence and its services
import SmartHomeScreen from '../screens/stay/SmartHomeScreen';
import RequestsScreen from '../screens/stay/RequestsScreen';
import DiningScreen from '../screens/stay/DiningScreen';
import ExperiencesScreen from '../screens/stay/ExperiencesScreen';
import TransfersScreen from '../screens/stay/TransfersScreen';
import BillScreen from '../screens/stay/BillScreen';
import MyStaysScreen from '../screens/stay/MyStaysScreen';
import StayDetailScreen from '../screens/stay/StayDetailScreen';
import RewardsScreen from '../screens/stay/RewardsScreen';
import DigitalKeyScreen from '../screens/wellness/DigitalKeyScreen';
import DepositBoxScreen from '../screens/wellness/DepositBoxScreen';
import ExploreScreen from '../screens/wellness/ExploreScreen';

// Signed in: wellness
import MoodHubScreen from '../screens/wellness/MoodHubScreen';
import RestoreScreen from '../screens/wellness/RestoreScreen';
import RechargeScreen from '../screens/wellness/RechargeScreen';
import ReflectScreen from '../screens/wellness/ReflectScreen';
import ExploreScreenMood from '../screens/wellness/ExploreScreenMood';
import DetailScreen from '../screens/wellness/DetailScreen';
import BookingsScreen from '../screens/wellness/BookingsScreen';

// Account
import PersonalDetailsScreen from '../screens/wellness/PersonalDetailsScreen';
import SettingsScreen from '../screens/wellness/SettingsScreen';
import TermsScreen from '../screens/wellness/TermsScreen';
import PrivacyScreen from '../screens/wellness/PrivacyScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import ChangePasswordScreen from '../screens/auth/ChangePasswordScreen';
import VerificationSuccessScreen from '../screens/auth/VerificationSuccessScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: ['home', 'home-outline', Ionicons],
  Wellness: ['spa', 'spa-outline', MaterialCommunityIcons],
  Residence: ['key', 'key-outline', Ionicons],
  Concierge: ['bell', 'bell-outline', MaterialCommunityIcons],
  Profile: ['person', 'person-outline', Ionicons],
};

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useLive();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.divider,
          borderTopWidth: 1,
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom + 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: 'rgba(242, 233, 216, 0.45)',
        tabBarLabelStyle: { fontSize: 9.5, letterSpacing: 0.3, fontFamily: FONTS.body },
        tabBarIcon: ({ focused, color }) => {
          const [on, off, Icon] = TAB_ICONS[route.name];
          return <Icon name={focused ? on : off} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wellness" component={WellnessScreen} />
      <Tab.Screen name="Residence" component={ResidenceScreen} />
      <Tab.Screen
        name="Concierge"
        component={ConciergeScreen}
        options={{ tabBarBadge: unreadCount ? (unreadCount > 9 ? '9+' : unreadCount) : undefined, tabBarBadgeStyle: { backgroundColor: COLORS.primary, color: COLORS.background, fontSize: 10 } }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: COLORS.background, card: COLORS.background, primary: COLORS.primary, text: COLORS.text, border: COLORS.border },
};

const stackOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.border, elevation: 0, shadowOpacity: 0 },
  headerTintColor: COLORS.text,
  headerTitleStyle: { fontFamily: FONTS.heading, fontSize: 15, letterSpacing: 0.5 },
  headerBackTitleVisible: false,
  cardStyle: { backgroundColor: COLORS.background },
};
const bare = { headerShown: false };

/**
 * Three sets of screens, chosen by the session: signed out (welcome, sign-in, sign-up, booking as a new guest),
 * a temporary password that must be changed first, and the signed-in app.
 */
export default function AppNavigator({ ready }) {
  const { user, loading } = useAuth();
  const [minSplash, setMinSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMinSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!ready || loading || minSplash) return <SplashScreen />;

  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      <Stack.Navigator screenOptions={stackOptions}>
        {!user ? (
          <Stack.Group>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={bare} />
            <Stack.Screen name="Login" component={LoginScreen} options={bare} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={bare} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={bare} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={bare} />
            <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} options={bare} />
            <Stack.Screen name="VerificationSuccess" component={VerificationSuccessScreen} options={bare} />
            <Stack.Screen name="BookStay" component={BookStayScreen} options={bare} />
          </Stack.Group>
        ) : user.mustChangePassword ? (
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Choose your password', headerLeft: () => null }} />
        ) : (
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabs} options={bare} />
            <Stack.Screen name="BookStay" component={BookStayScreen} options={bare} />

            <Stack.Screen name="SmartHome" component={SmartHomeScreen} options={bare} />
            <Stack.Screen name="Requests" component={RequestsScreen} options={bare} />
            <Stack.Screen name="Dining" component={DiningScreen} options={bare} />
            <Stack.Screen name="Experiences" component={ExperiencesScreen} options={bare} />
            <Stack.Screen name="Transfers" component={TransfersScreen} options={bare} />
            <Stack.Screen name="Bill" component={BillScreen} options={bare} />
            <Stack.Screen name="MyStays" component={MyStaysScreen} options={bare} />
            <Stack.Screen name="StayDetail" component={StayDetailScreen} options={bare} />
            <Stack.Screen name="Rewards" component={RewardsScreen} options={bare} />
            <Stack.Screen name="DigitalKey" component={DigitalKeyScreen} options={{ title: 'Digital Key' }} />
            <Stack.Screen name="DepositBox" component={DepositBoxScreen} options={bare} />
            <Stack.Screen name="Explore" component={ExploreScreen} options={{ title: 'Explore the Estate' }} />

            <Stack.Screen name="MoodHub" component={MoodHubScreen} options={({ route }) => ({ title: route.params?.title || 'Activities' })} />
            <Stack.Screen name="Restore" component={RestoreScreen} options={bare} />
            <Stack.Screen name="Recharge" component={RechargeScreen} options={bare} />
            <Stack.Screen name="Reflect" component={ReflectScreen} options={bare} />
            <Stack.Screen name="ExploreMood" component={ExploreScreenMood} options={bare} />
            <Stack.Screen name="Detail" component={DetailScreen} options={{ title: '' }} />
            <Stack.Screen name="Bookings" component={BookingsScreen} options={{ title: 'Bookings' }} />

            <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} options={{ title: 'Personal Details' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={bare} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
          </Stack.Group>
        )}
        {/* Reachable signed in or out */}
        <Stack.Group navigationKey={user ? 'in' : 'out'}>
          <Stack.Screen name="Terms" component={TermsScreen} options={{ title: 'Terms & Conditions' }} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: 'Privacy Policy' }} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
