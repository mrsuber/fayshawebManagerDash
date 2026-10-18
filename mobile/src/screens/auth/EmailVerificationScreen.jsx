import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';
import authService from '../../services/authService';

export default function EmailVerificationScreen({ route, navigation }) {
  const { email, token } = route.params || {};
  const [verificationToken, setVerificationToken] = useState(token || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!verificationToken || verificationToken.trim().length === 0) {
      setError('Please enter the verification token from your email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authService.verifyEmail(verificationToken.trim());

      if (response.success) {
        navigation.navigate('VerificationSuccess', {
          type: 'email_verification',
          message: 'Your email has been verified successfully',
        });
      } else {
        setError(response.error || 'Verification failed');
      }
    } catch (err) {
      console.error('Email verification error:', err);
      setError(
        err.error || 'Failed to verify email. The token may have expired.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>✉️</Text>
        </View>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a 6-digit verification code to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>
      </View>

      {/* Error Message */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Token Input */}
      <View style={styles.tokenContainer}>
        <Text style={styles.label}>VERIFICATION TOKEN</Text>
        <TextInput
          style={styles.tokenInput}
          placeholder="Enter token from email"
          placeholderTextColor="rgba(242, 233, 216, 0.3)"
          value={verificationToken}
          onChangeText={(text) => {
            setVerificationToken(text);
            if (error) setError('');
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Verify Button */}
      <TouchableOpacity
        style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
        onPress={() => handleVerify()}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.verifyButtonText}>VERIFY EMAIL</Text>
        )}
      </TouchableOpacity>

      {/* Help Text */}
      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          Check your email for the verification token and enter it above.
        </Text>
      </View>

      {/* Back to Login */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.backText}>← Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    color: COLORS.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  email: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  tokenContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.textTertiary,
    marginBottom: 8,
  },
  tokenInput: {
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    padding: 16,
    fontSize: 15,
    color: COLORS.text,
  },
  verifyButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: COLORS.background,
    fontSize: 14,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  helpContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  helpText: {
    fontSize: 13,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  backButton: {
    alignItems: 'center',
    padding: 12,
  },
  backText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    textAlign: 'center',
  },
});
