import * as Clipboard from 'expo-clipboard';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation } from '@react-navigation/native';
import { dayLabel } from '../../utils/format';
import { COLORS, FONTS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import wellnessUnifiedService from '../../services/wellnessUnifiedService';

export default function DigitalKeyScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [activeControl, setActiveControl] = useState(null);
  const [keyData, setKeyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [journeyBookings, setJourneyBookings] = useState([]); // NEW: Multiple journey bookings

  // Fetch journey bookings with PINs
  useEffect(() => {
    const loadJourneyBookings = async () => {
      try {
        const bookings = await wellnessUnifiedService.getJourneyBookingsWithPINs();
        console.log('📍 Loaded journey bookings with PINs:', bookings);
        setJourneyBookings(bookings || []);
      } catch (error) {
        console.error('Error loading journey bookings:', error);
        setJourneyBookings([]);
      }
    };

    if (user?.id) {
      loadJourneyBookings();
    }
  }, [user?.id]);

  // Fetch digital keys from backend
  const fetchDigitalKeys = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      setError(null);

      const response = await api.get(`/bookings/user/my-keys?user_id=${user.id}`);

      if (response.success) {
        const { apartments, wellnessJourneys } = response.keys;

        // Get the first (most recent) apartment booking
        const apartmentBooking = apartments[0];

        // Get the first (most recent) wellness journey booking
        const wellnessJourney = wellnessJourneys[0];

        if (apartmentBooking) {
          // Format the data to match the existing UI structure
          const formattedData = {
            bookingId: apartmentBooking.bookingId, // Store booking ID for navigation
            villaNumber: apartmentBooking.villaNumber,
            villaName: apartmentBooking.apartmentName,
            gateQRCode: apartmentBooking.gateQRCode,
            doorCode: apartmentBooking.doorPIN,
            wifi: apartmentBooking.wifi || null,
            // Stay dates are calendar days: check-in from 14:00, check-out by 11:00.
            checkIn: `${dayLabel(apartmentBooking.checkIn, { weekday: true })} · from 14:00`,
            checkOut: `${dayLabel(apartmentBooking.checkOut, { weekday: true })} · 11:00`,
            emergencyContact: '+237 653 255 547',
            concierge: '+237 651 841 003',
            inHouse: apartmentBooking.status === 'active',
            // Wellness Journey (if exists)
            restoreJourney: wellnessJourney ? {
              active: true,
              date: new Date(wellnessJourney.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }),
              time: new Date(`2000-01-01T${wellnessJourney.time}`).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              }),
              pin: wellnessJourney.journeyPIN,
              stages: [
                { id: 1, name: 'Massage Therapy', completed: false },
                { id: 2, name: 'Steam Room', completed: false },
                { id: 3, name: 'Cold Plunge', completed: false },
              ],
            } : null,
            // Deposit Box
            depositBox: {
              boxNumber: apartmentBooking.depositBox.number,
              currentPin: apartmentBooking.depositBox.pin,
              status: apartmentBooking.depositBox.status,
              lastUpdated: 'Recently',
              hasNewPackage: apartmentBooking.depositBox.packageCount > 0,
              packageCount: apartmentBooking.depositBox.packageCount,
            },
          };

          setKeyData(formattedData);
        } else {
          // No active bookings
          setKeyData(null);
        }
      }
    } catch (err) {
      console.error('Error fetching digital keys:', err);
      setError(err.message || 'Failed to load digital keys');
    } finally {
      setLoading(false);
      if (isRefreshing) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchDigitalKeys();
    }
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDigitalKeys(true);
  };


  const copyToClipboard = (text, label) => {
    Clipboard.setStringAsync(String(text ?? '')).catch(() => {});
    Alert.alert('Copied!', `${label} copied to clipboard`);
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your digital keys...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchDigitalKeys()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Use default data when no active bookings (but still show helpful info)
  const displayData = keyData || {
    villaNumber: null,
    villaName: null,
    gateQRCode: null,
    doorCode: null,
    wifi: null,
    checkIn: null,
    checkOut: null,
    emergencyContact: '+237 653 255 547',
    concierge: '+237 651 841 003',
    restoreJourney: null,
    depositBox: null,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Villa Header - Only show if there's an active booking */}
        {displayData.villaNumber && (
          <View style={styles.header}>
            <Text style={styles.villaLabel}>{displayData.villaNumber}</Text>
            <Text style={styles.villaName}>{displayData.villaName}</Text>
            <View style={styles.datesBadge}>
              <Text style={styles.datesText}>{displayData.checkIn}</Text>
            </View>
          </View>
        )}

        {/* No Active Booking Message */}
        {!keyData && (
          <View style={styles.noKeysNotice}>
            <Text style={styles.noKeysIcon}>🔑</Text>
            <Text style={styles.noKeysTitle}>No Active Bookings</Text>
            <Text style={styles.noKeysText}>
              You don't have any active bookings at the moment. Your gate code, door PIN and deposit box appear here once your stay is confirmed.
            </Text>
          </View>
        )}

        {/* QR Code Card - Gate Access - Only show if keys exist */}
        {displayData.gateQRCode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GATE ACCESS</Text>
            <View style={styles.qrCard}>
              <LinearGradient
                colors={['rgba(200, 164, 93, 0.1)', 'rgba(200, 164, 93, 0.05)']}
                style={styles.qrCardGradient}
              >
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={displayData.gateQRCode}
                    size={180}
                    color="#0D0D0D"
                    backgroundColor="#F2E9D8"
                    quietZone={0}
                  />
                </View>
                <Text style={styles.qrLabel}>Scan at gate to enter</Text>
                <Text style={styles.qrSubtext}>Hold phone steady • Works offline</Text>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* Door Access Code - Only show if door code exists */}
        {displayData.doorCode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DOOR ACCESS</Text>
            <TouchableOpacity
              style={styles.codeCard}
              onPress={() => copyToClipboard(displayData.doorCode, 'Door code')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(13, 13, 13, 0.6)', 'rgba(13, 13, 13, 0.9)']}
                style={styles.codeCardGradient}
              >
                <View style={styles.codeHeader}>
                  <Text style={styles.codeLabel}>Door PIN</Text>
                  <View style={styles.copyBadge}>
                    <Text style={styles.copyBadgeText}>TAP TO COPY</Text>
                  </View>
                </View>
                <Text style={styles.codeDisplay}>{displayData.doorCode}</Text>
                <Text style={styles.codeHint}>Enter on keypad next to door</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Deposit Box Section - Only show if deposit box exists */}
        {displayData.depositBox && (
          <View style={styles.section}>
          <View style={styles.depositBoxHeader}>
            <Text style={styles.sectionTitle}>DEPOSIT BOX</Text>
            {displayData.depositBox.hasNewPackage && (
              <View style={styles.newPackageBadge}>
                <Text style={styles.newPackageBadgeText}>
                  {displayData.depositBox.packageCount} NEW
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.depositBoxCard}
            onPress={() => copyToClipboard(displayData.depositBox.currentPin, 'Deposit Box PIN')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                displayData.depositBox.status === 'package_waiting'
                  ? ['rgba(200, 164, 93, 0.2)', 'rgba(200, 164, 93, 0.1)']
                  : ['rgba(13, 13, 13, 0.5)', 'rgba(13, 13, 13, 0.7)']
              }
              style={styles.depositBoxGradient}
            >
              {/* Header with Box Number and Status */}
              <View style={styles.depositBoxTopRow}>
                <View style={styles.depositBoxInfo}>
                  <Text style={styles.depositBoxNumber}>Box {displayData.depositBox.boxNumber}</Text>
                  <Text style={styles.depositBoxUpdated}>
                    Updated {displayData.depositBox.lastUpdated}
                  </Text>
                </View>
                <View
                  style={[
                    styles.depositStatusBadge,
                    displayData.depositBox.status === 'package_waiting' && styles.depositStatusActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.depositStatusText,
                      displayData.depositBox.status === 'package_waiting' &&
                        styles.depositStatusTextActive,
                    ]}
                  >
                    {displayData.depositBox.status === 'package_waiting' ? '📦 PACKAGE' : '✓ EMPTY'}
                  </Text>
                </View>
              </View>

              {/* PIN Display */}
              <View style={styles.depositPinSection}>
                <View style={styles.depositPinHeader}>
                  <Text style={styles.depositPinLabel}>Current Access PIN</Text>
                  <View style={styles.copyBadge}>
                    <Text style={styles.copyBadgeText}>TAP TO COPY</Text>
                  </View>
                </View>
                <Text style={styles.depositPinDisplay}>{displayData.depositBox.currentPin}</Text>
              </View>

              {/* Info Message */}
              <View style={styles.depositInfoBox}>
                <Text style={styles.depositInfoIcon}>🔄</Text>
                <Text style={styles.depositInfoText}>
                  PIN automatically changes after each opening for security
                </Text>
              </View>

              {/* View History Button */}
              <TouchableOpacity
                style={styles.viewHistoryButton}
                onPress={() => navigation.navigate('DepositBox', {
                  bookingId: displayData.bookingId,
                  depositBoxData: displayData.depositBox
                })}
                activeOpacity={0.8}
              >
                <Text style={styles.viewHistoryText}>View Package History</Text>
                <Text style={styles.viewHistoryArrow}>→</Text>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
          </View>
        )}

        {/* Restore Journey PIN - Only show if user has active booking */}
        {displayData.restoreJourney?.active && (
          <View style={styles.section}>
            <View style={styles.journeySectionHeader}>
              <Text style={styles.sectionTitle}>RESTORE JOURNEY</Text>
              <View style={styles.journeyTimeBadge}>
                <Text style={styles.journeyTimeText}>
                  {displayData.restoreJourney.date} • {displayData.restoreJourney.time}
                </Text>
              </View>
            </View>

            {/* Journey PIN Card */}
            <TouchableOpacity
              style={styles.journeyPinCard}
              onPress={() => copyToClipboard(displayData.restoreJourney.pin, 'Journey PIN')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(127, 174, 138, 0.2)', 'rgba(74, 124, 89, 0.25)']}
                style={styles.journeyPinGradient}
              >
                <View style={styles.journeyPinHeader}>
                  <View style={styles.journeyIconBox}>
                    <Text style={styles.journeyIcon}>✦</Text>
                  </View>
                  <View style={styles.journeyPinInfo}>
                    <Text style={styles.journeyPinLabel}>Journey Access PIN</Text>
                    <Text style={styles.journeyPinSubtext}>
                      Use this PIN at each stage entrance
                    </Text>
                  </View>
                  <View style={styles.copyBadge}>
                    <Text style={styles.copyBadgeText}>TAP TO COPY</Text>
                  </View>
                </View>

                <Text style={styles.journeyPinDisplay}>{displayData.restoreJourney.pin}</Text>

                {/* Journey Stages Progress */}
                <View style={styles.journeyStages}>
                  {displayData.restoreJourney.stages.map((stage, index) => (
                    <View key={stage.id} style={styles.stageProgressRow}>
                      {/* Stage Number */}
                      <View
                        style={[
                          styles.stageNumberCircle,
                          stage.completed && styles.stageNumberCircleCompleted,
                        ]}
                      >
                        {stage.completed ? (
                          <Text style={styles.stageCheckmark}>✓</Text>
                        ) : (
                          <Text
                            style={[
                              styles.stageNumberText,
                              stage.completed && styles.stageNumberTextCompleted,
                            ]}
                          >
                            {stage.id}
                          </Text>
                        )}
                      </View>

                      {/* Stage Name */}
                      <Text
                        style={[
                          styles.stageName,
                          stage.completed && styles.stageNameCompleted,
                        ]}
                      >
                        {stage.name}
                      </Text>

                      {/* Connection Line */}
                      {index < displayData.restoreJourney.stages.length - 1 && (
                        <View style={styles.stageConnectionLine} />
                      )}
                    </View>
                  ))}
                </View>

                <Text style={styles.journeyPinFooter}>
                  Your progress is automatically tracked as you enter each stage
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* NEW: Wellness Journey PINs - Show all active journey bookings */}
        {journeyBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WELLNESS JOURNEY ACCESS</Text>
            {journeyBookings.map((journey, idx) => {
              const journeyDate = new Date(journey.booking_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });
              const timeMatch = journey.start_time?.match(/(\d+):(\d+)/);
              let journeyTime = journey.start_time;
              if (timeMatch) {
                const [, hours, minutes] = timeMatch;
                const hour = parseInt(hours);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
                journeyTime = `${displayHour}:${minutes} ${ampm}`;
              }

              return (
                <View key={journey.id} style={idx > 0 ? { marginTop: 16 } : null}>
                  <View style={styles.journeySectionHeader}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#7fae8a', marginBottom: 8 }}>
                      {journey.activity_name}
                    </Text>
                    <View style={styles.journeyTimeBadge}>
                      <Text style={styles.journeyTimeText}>
                        {journeyDate} • {journeyTime}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.journeyPinCard}
                    onPress={() => copyToClipboard(journey.activity_pin, `${journey.activity_name} PIN`)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['rgba(127, 174, 138, 0.2)', 'rgba(74, 124, 89, 0.25)']}
                      style={styles.journeyPinGradient}
                    >
                      <View style={styles.journeyPinHeader}>
                        <View style={styles.journeyIconBox}>
                          <Text style={styles.journeyIcon}>✦</Text>
                        </View>
                        <View style={styles.journeyPinInfo}>
                          <Text style={styles.journeyPinLabel}>Journey PIN</Text>
                          <Text style={styles.journeyPinSubtext}>
                            Tap to copy access code
                          </Text>
                        </View>
                        <View style={styles.copyBadge}>
                          <Text style={styles.copyBadgeText}>TAP TO COPY</Text>
                        </View>
                      </View>

                      <Text style={styles.journeyPinDisplay}>{journey.activity_pin}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* WiFi Credentials (set per property on the server) */}
        {keyData?.wifi?.ssid ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WiFi NETWORK</Text>
          <View style={styles.wifiCard}>
            {/* Network Name */}
            <TouchableOpacity
              style={styles.wifiRow}
              onPress={() => copyToClipboard(displayData.wifi.ssid, 'WiFi name')}
              activeOpacity={0.8}
            >
              <View style={styles.wifiIconContainer}>
                <Text style={styles.wifiIcon}>📶</Text>
              </View>
              <View style={styles.wifiInfo}>
                <Text style={styles.wifiLabel}>Network</Text>
                <Text style={styles.wifiValue}>{displayData.wifi.ssid}</Text>
              </View>
              <View style={styles.wifiCopy}>
                <Text style={styles.wifiCopyIcon}>📋</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.wifiDivider} />

            {/* Password */}
            <TouchableOpacity
              style={styles.wifiRow}
              onPress={() => copyToClipboard(displayData.wifi.password, 'WiFi password')}
              activeOpacity={0.8}
            >
              <View style={styles.wifiIconContainer}>
                <Text style={styles.wifiIcon}>🔐</Text>
              </View>
              <View style={styles.wifiInfo}>
                <Text style={styles.wifiLabel}>Password</Text>
                <Text style={styles.wifiValue}>{displayData.wifi.password}</Text>
              </View>
              <View style={styles.wifiCopy}>
                <Text style={styles.wifiCopyIcon}>📋</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        ) : null}

        {/* Smart home: the real controls live on their own screen */}
        {keyData?.inHouse ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SMART HOME</Text>
            <TouchableOpacity style={styles.contactCard} onPress={() => navigation.navigate('SmartHome')} activeOpacity={0.8}>
              <View style={styles.contactIcon}>
                <Text style={styles.contactEmoji}>🏠</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Climate, scenes and lights</Text>
                <Text style={styles.contactNumber}>Open smart home  ›</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Emergency & Contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IMPORTANT CONTACTS</Text>

          {/* Emergency */}
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => copyToClipboard(displayData.emergencyContact, 'Emergency number')}
            activeOpacity={0.8}
          >
            <View style={styles.contactIcon}>
              <Text style={styles.contactEmoji}>🚨</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Emergency</Text>
              <Text style={styles.contactNumber}>{displayData.emergencyContact}</Text>
            </View>
          </TouchableOpacity>

          {/* Concierge */}
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => copyToClipboard(displayData.concierge, 'Concierge number')}
            activeOpacity={0.8}
          >
            <View style={styles.contactIcon}>
              <Text style={styles.contactEmoji}>✦</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Concierge</Text>
              <Text style={styles.contactNumber}>{displayData.concierge}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Check-out Info - Only show if active booking */}
        {displayData.checkOut && (
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutLabel}>Check-out</Text>
            <Text style={styles.checkoutDate}>{displayData.checkOut}</Text>
            <Text style={styles.checkoutNote}>
              Please vacate by 11:00 AM • Late checkout available
            </Text>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 22,
    paddingBottom: 40,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  villaLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.textTertiary,
  },
  villaName: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    color: COLORS.text,
    marginTop: 4,
    marginBottom: 12,
  },
  datesBadge: {
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  datesText: {
    fontSize: 11,
    color: COLORS.primary,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.textTertiary,
    marginBottom: 12,
  },

  // QR Code Card
  qrCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  qrCardGradient: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  qrCodeContainer: {
    backgroundColor: '#F2E9D8',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  qrLabel: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  qrSubtext: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },

  // Door Code Card
  codeCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  codeCardGradient: {
    padding: 20,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  copyBadge: {
    backgroundColor: 'rgba(200, 164, 93, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copyBadgeText: {
    fontSize: 9,
    letterSpacing: 1,
    color: COLORS.primary,
    fontWeight: '600',
  },
  codeDisplay: {
    fontFamily: FONTS.heading,
    fontSize: 48,
    letterSpacing: 12,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  codeHint: {
    fontSize: 11,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },

  // Deposit Box Section
  depositBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  newPackageBadge: {
    backgroundColor: 'rgba(200, 164, 93, 0.25)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newPackageBadgeText: {
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.primary,
    fontWeight: '700',
  },
  depositBoxCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(200, 164, 93, 0.4)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  depositBoxGradient: {
    padding: 20,
  },
  depositBoxTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  depositBoxInfo: {
    flex: 1,
  },
  depositBoxNumber: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  depositBoxUpdated: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  depositStatusBadge: {
    backgroundColor: 'rgba(242, 233, 216, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(242, 233, 216, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  depositStatusActive: {
    backgroundColor: 'rgba(200, 164, 93, 0.2)',
    borderColor: COLORS.primary,
  },
  depositStatusText: {
    fontSize: 10,
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  depositStatusTextActive: {
    color: COLORS.primary,
  },
  depositPinSection: {
    backgroundColor: 'rgba(13, 13, 13, 0.4)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  depositPinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  depositPinLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  depositPinDisplay: {
    fontFamily: FONTS.heading,
    fontSize: 42,
    letterSpacing: 10,
    color: COLORS.primary,
    textAlign: 'center',
  },
  depositInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  depositInfoIcon: {
    fontSize: 16,
  },
  depositInfoText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(242, 233, 216, 0.75)',
    lineHeight: 16,
  },
  viewHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  viewHistoryText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  viewHistoryArrow: {
    fontSize: 14,
    color: COLORS.primary,
  },

  // Restore Journey PIN Section
  journeySectionHeader: {
    marginBottom: 12,
  },
  journeyTimeBadge: {
    backgroundColor: 'rgba(127, 174, 138, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  journeyTimeText: {
    fontSize: 11,
    color: '#7fae8a',
    fontWeight: '600',
  },
  journeyPinCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(127, 174, 138, 0.4)',
    shadowColor: '#7fae8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  journeyPinGradient: {
    padding: 20,
  },
  journeyPinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  journeyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(127, 174, 138, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyIcon: {
    fontSize: 22,
    color: '#7fae8a',
  },
  journeyPinInfo: {
    flex: 1,
  },
  journeyPinLabel: {
    fontSize: 13,
    color: '#7fae8a',
    fontWeight: '700',
    marginBottom: 2,
  },
  journeyPinSubtext: {
    fontSize: 11,
    color: 'rgba(242, 233, 216, 0.7)',
  },
  journeyPinDisplay: {
    fontFamily: FONTS.heading,
    fontSize: 56,
    letterSpacing: 16,
    color: '#7fae8a',
    textAlign: 'center',
    marginVertical: 20,
    textShadowColor: 'rgba(127, 174, 138, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  journeyStages: {
    backgroundColor: 'rgba(13, 13, 13, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  stageProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  stageNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(127, 174, 138, 0.2)',
    borderWidth: 2,
    borderColor: '#7fae8a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageNumberCircleCompleted: {
    backgroundColor: '#7fae8a',
  },
  stageNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7fae8a',
  },
  stageNumberTextCompleted: {
    color: COLORS.background,
  },
  stageCheckmark: {
    fontSize: 16,
    color: COLORS.background,
    fontWeight: '700',
  },
  stageName: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
  },
  stageNameCompleted: {
    color: 'rgba(242, 233, 216, 0.6)',
    textDecorationLine: 'line-through',
  },
  stageConnectionLine: {
    position: 'absolute',
    left: 15,
    top: 32,
    width: 2,
    height: 20,
    backgroundColor: 'rgba(127, 174, 138, 0.3)',
  },
  journeyPinFooter: {
    fontSize: 11,
    color: 'rgba(242, 233, 216, 0.65)',
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },

  // WiFi Card
  wifiCard: {
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    overflow: 'hidden',
  },
  wifiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  wifiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiIcon: {
    fontSize: 18,
  },
  wifiInfo: {
    flex: 1,
  },
  wifiLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginBottom: 2,
  },
  wifiValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  wifiCopy: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiCopyIcon: {
    fontSize: 14,
  },
  wifiDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },

  // Smart Controls
  controlsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  controlCard: {
    flex: 1,
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  controlCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
  },
  controlIcon: {
    fontSize: 24,
  },
  controlLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  controlStatus: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },

  // Contacts
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactEmoji: {
    fontSize: 20,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginBottom: 2,
  },
  contactNumber: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
  },

  // Checkout Card
  checkoutCard: {
    backgroundColor: 'rgba(200, 164, 93, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.25)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  checkoutLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.textTertiary,
  },
  checkoutDate: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.primary,
    marginTop: 6,
    marginBottom: 8,
  },
  checkoutNote: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },

  bottomSpacing: {
    height: 20,
  },

  // No Keys Notice (shown in main content)
  noKeysNotice: {
    backgroundColor: 'rgba(200, 164, 93, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.25)',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
  },
  noKeysIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  noKeysTitle: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  noKeysText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Loading, Error, Empty States
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 14,
    color: COLORS.background,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
