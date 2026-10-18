import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, FONTS } from '../constants/theme';

/**
 * Premium Modal Component - Matches payment success design
 *
 * @param {boolean} visible - Whether the modal is visible
 * @param {string} type - Type: 'success', 'error', 'warning', 'info', 'confirm'
 * @param {string} icon - Custom icon/emoji (optional, defaults based on type)
 * @param {string} title - Main title text
 * @param {string} subtitle - Subtitle text (optional)
 * @param {string} message - Detailed message (optional)
 * @param {string} primaryButtonText - Text for primary action button
 * @param {function} onPrimaryPress - Callback for primary button
 * @param {string} secondaryButtonText - Text for secondary button (optional)
 * @param {function} onSecondaryPress - Callback for secondary button (optional)
 * @param {function} onClose - Callback when modal closes
 * @param {boolean} closeOnOverlayPress - Whether to close when overlay is pressed (default: true)
 */
export default function PremiumModal({
  visible = false,
  type = 'info',
  icon = null,
  title,
  subtitle = null,
  message = null,
  primaryButtonText = 'OK',
  onPrimaryPress,
  secondaryButtonText = null,
  onSecondaryPress = null,
  onClose,
  closeOnOverlayPress = true,
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Get default icon based on type
  const getDefaultIcon = () => {
    if (icon) return icon;

    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'confirm':
        return '?';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  // Get icon background color based on type
  const getIconBgColor = () => {
    switch (type) {
      case 'success':
        return 'rgba(127, 174, 138, 0.15)';
      case 'error':
        return 'rgba(255, 77, 77, 0.15)';
      case 'warning':
        return 'rgba(255, 159, 28, 0.15)';
      case 'confirm':
        return 'rgba(74, 144, 226, 0.15)';
      case 'info':
      default:
        return 'rgba(127, 174, 138, 0.15)';
    }
  };

  // Get icon color based on type
  const getIconColor = () => {
    switch (type) {
      case 'success':
        return '#7fae8a';
      case 'error':
        return '#ff4d4d';
      case 'warning':
        return '#ff9f1c';
      case 'confirm':
        return '#4a90e2';
      case 'info':
      default:
        return '#7fae8a';
    }
  };

  // Get primary button color based on type
  const getPrimaryButtonColor = () => {
    switch (type) {
      case 'success':
        return '#7fae8a';
      case 'error':
        return '#ff4d4d';
      case 'warning':
        return '#ff9f1c';
      case 'confirm':
        return '#4a90e2';
      case 'info':
      default:
        return '#4a90e2';
    }
  };

  const handleOverlayPress = () => {
    if (closeOnOverlayPress && onClose) {
      onClose();
    }
  };

  const handlePrimaryPress = () => {
    if (onPrimaryPress) {
      onPrimaryPress();
    }
    if (onClose) {
      onClose();
    }
  };

  const handleSecondaryPress = () => {
    if (onSecondaryPress) {
      onSecondaryPress();
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleOverlayPress}
      >
        {/* Blur effect for iOS */}
        {Platform.OS === 'ios' && (
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        )}

        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            {/* Icon Circle */}
            <View style={[styles.iconContainer, { backgroundColor: getIconBgColor() }]}>
              <Text style={[styles.iconText, { color: getIconColor() }]}>
                {getDefaultIcon()}
              </Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Subtitle */}
            {subtitle && (
              <Text style={styles.subtitle}>{subtitle}</Text>
            )}

            {/* Message */}
            {message && (
              <Text style={styles.message}>{message}</Text>
            )}

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {/* Primary Button */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: getPrimaryButtonColor() },
                ]}
                onPress={handlePrimaryPress}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
              </TouchableOpacity>

              {/* Secondary Button */}
              {secondaryButtonText && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleSecondaryPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryButtonText}>{secondaryButtonText}</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 36,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: FONTS.heading,
  },
  subtitle: {
    fontSize: 16,
    color: '#4a4a4a',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },
  message: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  secondaryButtonText: {
    color: '#4a4a4a',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
