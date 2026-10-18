import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../constants/theme';
import { SUNSET_IMAGE } from '../constants/images';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  const handleCreateAccount = () => {
    navigation.navigate('SignUp');
  };

  const handleGuestBooking = () => {
    navigation.navigate('BookStay');
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={SUNSET_IMAGE}
        style={styles.backgroundImage}
        blurRadius={0}
      >
        {/* Gradient overlay - starts from middle, becomes black at bottom */}
        <LinearGradient
          colors={[
            'rgba(0, 0, 0, 0)',           // Transparent at top
            'rgba(0, 0, 0, 0.3)',         // Slight dark at 30%
            'rgba(0, 0, 0, 0.7)',         // More dark at 50%
            'rgba(0, 0, 0, 0.9)',         // Very dark at 70%
            '#000000',                     // Pure black at bottom
          ]}
          locations={[0, 0.3, 0.5, 0.7, 1]}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={styles.textContainer}>
              <Text style={styles.heading}>
                One destination.{'\n'}Endless serenity.
              </Text>
              <Text style={styles.description}>
                Your personal wellness companion — restore, recharge, reflect and explore, all in one place.
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSignIn}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>SIGN IN</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleCreateAccount}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>CREATE ACCOUNT</Text>
              </TouchableOpacity>

              {/* Guest Booking Option */}
              <TouchableOpacity
                style={styles.exploreButton}
                onPress={handleGuestBooking}
                activeOpacity={0.8}
              >
                <View style={styles.exploreIcon}>
                  <Text style={styles.exploreIconText}>🏨</Text>
                </View>
                <View style={styles.exploreTextContainer}>
                  <Text style={styles.exploreButtonTitle}>New Guest? Book Your Stay</Text>
                  <Text style={styles.exploreButtonSubtitle}>
                    Book now • Account created automatically
                  </Text>
                </View>
                <Text style={styles.exploreChevron}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 28,
    paddingBottom: 40,
    gap: 22,
  },
  textContainer: {
    gap: 10,
  },
  heading: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.text,
    letterSpacing: 1,
    lineHeight: 33.6,
  },
  description: {
    fontSize: 13,
    color: COLORS.textTertiary,
    lineHeight: 19.5,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 4,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.background,
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 4,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: '500',
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.4)',
    backgroundColor: 'rgba(200, 164, 93, 0.08)',
    padding: 14,
    borderRadius: 4,
    gap: 12,
    marginTop: 8,
  },
  exploreIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exploreIconText: {
    fontSize: 20,
  },
  exploreTextContainer: {
    flex: 1,
  },
  exploreButtonTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  exploreButtonSubtitle: {
    color: COLORS.textTertiary,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  exploreChevron: {
    fontSize: 24,
    color: COLORS.primary,
  },
});
