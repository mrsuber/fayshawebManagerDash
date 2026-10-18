import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/LiveContext';
import { COLORS, FONTS } from '../../constants/theme';
import { MOOD_DATA, QUICK_ACTIONS } from '../../constants/wellnessData';
import wellnessUnifiedService from '../../services/wellnessUnifiedService';
import guest from '../../services/guestService';
import { firstName } from '../../contexts/AuthContext';
import { useLiveEvent } from '../../contexts/LiveContext';
import { fileUrl } from '../../config';
import { stayRange, parseDay } from '../../utils/format';

const { width } = Dimensions.get('window');

const daysUntil = (iso) => Math.round((parseDay(iso) - parseDay(new Date().toISOString().slice(0, 10))) / 86400000);

/** The current or next stay, or an invitation to book. */
function StayCard({ overview, navigation }) {
  if (!overview) return null;
  const stay = overview.stay;
  if (!stay) {
    return (
      <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate('BookStay')} style={styles.stayCard}>
        <LinearGradient colors={['rgba(200, 164, 93, 0.16)', 'rgba(200, 164, 93, 0.04)']} style={styles.stayInvite}>
          <Text style={styles.stayEyebrow}>YOUR NEXT ESCAPE</Text>
          <Text style={styles.stayName}>Book a residence</Text>
          <Text style={styles.stayMeta}>Choose your dates — your key, smart home and services follow.</Text>
          <Text style={styles.stayCta}>See availability  →</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  const inHouse = stay.status === 'checked_in';
  const days = daysUntil(stay.checkIn);
  const eyebrow = inHouse
    ? 'WELCOME HOME'
    : stay.status === 'pending'
    ? 'AWAITING PAYMENT'
    : days <= 0
    ? 'ARRIVING TODAY'
    : days === 1
    ? 'ARRIVING TOMORROW'
    : `ARRIVING IN ${days} DAYS`;
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('Residence')} style={styles.stayCard}>
      <ImageBackground
        source={stay.residence.image ? { uri: fileUrl(stay.residence.image) } : require('../../../assets/explore.jpg')}
        style={styles.stayImage}
        imageStyle={{ borderRadius: 16 }}
      >
        <LinearGradient colors={['rgba(13,13,13,0.2)', 'rgba(13,13,13,0.92)']} style={styles.stayShade}>
          <Text style={styles.stayEyebrow}>{eyebrow}</Text>
          <Text style={styles.stayName}>{stay.residence.name}</Text>
          <Text style={styles.stayMeta}>Residence {stay.residence.unit} · {stayRange(stay.checkIn, stay.checkOut)}</Text>
          <View style={styles.stayLinks}>
            <Text style={styles.stayCta}>{inHouse ? 'Your residence  →' : 'Prepare your stay  →'}</Text>
            {overview.openRequests ? <Text style={styles.stayBadge}>{overview.openRequests} open request{overview.openRequests > 1 ? 's' : ''}</Text> : null}
          </View>
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const { unreadCount, latestUnreadMessage, refreshUnreadCount } = useChat();
  const [greeting, setGreeting] = useState('GOOD EVENING');
  const [todaysBookings, setTodaysBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [overview, setOverview] = useState(null);

  const fetchOverview = async () => {
    try {
      setOverview(await guest.overview());
    } catch (error) {
      // keep the last overview when offline
    }
  };
  useLiveEvent('stay:confirmed', fetchOverview);

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) {
        setGreeting('GOOD MORNING');
      } else if (hour < 18) {
        setGreeting('GOOD AFTERNOON');
      } else {
        setGreeting('GOOD EVENING');
      }
    };

    updateGreeting();
    // Update greeting every minute
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's bookings
  const fetchTodaysBookings = async () => {
    try {
      setLoadingBookings(true);
      const response = await wellnessUnifiedService.getMyBookings();

      if (response && response.bookings) {
        // Get today's date in YYYY-MM-DD format (local timezone)
        const today = new Date();
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Filter for today's bookings only (upcoming or in-progress)
        const todayOnly = response.bookings.filter(booking => {
          return (
            booking.booking_date === todayString &&
            (booking.status === 'upcoming' || booking.status === 'in_progress')
          );
        });

        console.log('📅 Today\'s bookings:', todayOnly.length);
        setTodaysBookings(todayOnly);
      }
    } catch (error) {
      console.error('Error fetching today\'s bookings:', error);
      setTodaysBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Refresh unread count and bookings when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🏠 Home screen focused, refreshing unread count and bookings...');
      refreshUnreadCount();
      fetchTodaysBookings();
      fetchOverview();
    }, [])
  );

  // Debug: Log unread count changes
  useEffect(() => {
    console.log(`🔔 Unread count updated: ${unreadCount}`);
    console.log(`📩 Latest unread message:`, latestUnreadMessage?.message || 'None');
  }, [unreadCount, latestUnreadMessage]);

  const getUserFirstName = () => firstName(user);

  const handleMoodPress = (moodKey) => {
    // Navigate to dedicated mood screen for premium experience
    if (moodKey === 'restore') {
      navigation.navigate('Restore');
    } else if (moodKey === 'recharge') {
      navigation.navigate('Recharge');
    } else if (moodKey === 'reflect') {
      navigation.navigate('Reflect');
    } else if (moodKey === 'explore') {
      navigation.navigate('ExploreMood');
    } else {
      // Fallback to standard MoodHub
      navigation.navigate('MoodHub', { moodKey });
    }
  };

  const handleQuickAction = (screen) => {
    navigation.navigate(screen);
  };

  const handleCompanionPress = () => {
    navigation.navigate('Concierge');
  };

  const handleBookingPress = (booking) => {
    // Navigate to bookings screen with the specific booking
    navigation.navigate('Bookings', { bookingId: booking.id });
  };

  const formatBookingTime = (startTime) => {
    if (!startTime) return '';

    // Parse time (HH:MM:SS or HH:MM format)
    const [hours, minutes] = startTime.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    return `Today, ${displayHour}:${minutes} ${ampm}`;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'restore': '🧘',
      'recharge': '💪',
      'reflect': '🌅',
      'explore': '🗺️',
      'spa': '💆',
      'fitness': '🏋️',
      'dining': '🍽️',
    };
    return icons[category?.toLowerCase()] || '✨';
  };

  // Get display text for AI companion card
  const getCompanionMessage = () => {
    if (!latestUnreadMessage) {
      return 'Your sunset ceremony begins in 30 minutes — shall I reserve your seat?';
    }

    // Parse metadata if it's a string
    let metadata = latestUnreadMessage.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }

    // If message has an attachment, show attachment indicator
    if (metadata?.attachment) {
      const attachmentType = metadata.attachment.type === 'image' ? '🖼️ Image' : '📄 Document';
      if (latestUnreadMessage.message && !latestUnreadMessage.message.includes('📎')) {
        return `${attachmentType}: ${latestUnreadMessage.message}`;
      }
      return `${attachmentType} from concierge`;
    }

    // Return the message text
    return latestUnreadMessage.message || 'You have a new message from concierge';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Premium Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.userName}>{getUserFirstName()}</Text>
          </View>
          <TouchableOpacity onPress={handleCompanionPress} activeOpacity={0.85}>
            <LinearGradient
              colors={['rgba(200, 164, 93, 0.2)', 'rgba(200, 164, 93, 0.1)']}
              style={styles.aiButton}
            >
              <LinearGradient
                colors={['#C8A45D', '#D68910']}
                style={styles.aiButtonInner}
              >
                <Text style={styles.aiButtonText}>AI</Text>
              </LinearGradient>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <StayCard overview={overview} navigation={navigation} />

        {/* Mood Question */}
        <Text style={styles.moodQuestion}>How would you like to feel today?</Text>

        {/* Mood Cards Grid */}
        <View style={styles.moodGrid}>
          {Object.keys(MOOD_DATA).map((moodKey) => {
            const mood = MOOD_DATA[moodKey];
            return (
              <TouchableOpacity
                key={moodKey}
                style={styles.moodCard}
                onPress={() => handleMoodPress(moodKey)}
                activeOpacity={0.8}
              >
                <ImageBackground source={mood.img} style={styles.moodCardBg} imageStyle={styles.moodCardImage}>
                  <LinearGradient
                    colors={['rgba(13,13,13,0.15)', 'rgba(13,13,13,0.85)']}
                    style={styles.moodCardGradient}
                  >
                    <Text style={styles.moodCardLabel}>{mood.label}</Text>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Premium Quick Access */}
        <Text style={styles.sectionTitle}>QUICK ACCESS</Text>
        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((action, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleQuickAction(action.screen)}
              activeOpacity={0.85}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={['rgba(200, 164, 93, 0.08)', 'rgba(200, 164, 93, 0.03)']}
                style={styles.quickActionCard}
              >
                <LinearGradient
                  colors={['rgba(200, 164, 93, 0.25)', 'rgba(200, 164, 93, 0.15)']}
                  style={styles.quickActionIcon}
                >
                  <Text style={styles.quickActionGlyph}>{action.glyph}</Text>
                </LinearGradient>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Premium AI Companion Card - Only show when there's an unread message */}
        {latestUnreadMessage && (
          <TouchableOpacity onPress={handleCompanionPress} activeOpacity={0.85}>
            <LinearGradient
              colors={['rgba(200, 164, 93, 0.12)', 'rgba(200, 164, 93, 0.05)']}
              style={styles.companionCard}
            >
              <View style={styles.companionHeader}>
                <View style={styles.companionTitleContainer}>
                  <LinearGradient
                    colors={['#C8A45D', '#D68910']}
                    style={styles.companionIconGradient}
                  >
                    <Text style={styles.companionIcon}>✦</Text>
                  </LinearGradient>
                  <Text style={styles.companionTitle}>FAYSHA AI COMPANION</Text>
                </View>
                {unreadCount > 1 && (
                  <LinearGradient
                    colors={['#E63946', '#C62828']}
                    style={styles.companionBadge}
                  >
                    <Text style={styles.companionBadgeText}>{unreadCount}</Text>
                  </LinearGradient>
                )}
              </View>
              <Text style={styles.companionText}>{getCompanionMessage()}</Text>
              <View style={styles.companionCtaContainer}>
                <Text style={styles.companionCta}>Tap to respond</Text>
                <Text style={styles.companionArrow}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Today's Schedule */}
        {todaysBookings.length > 0 && (
          <View style={styles.scheduleContainer}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.sectionTitle}>TODAY'S SCHEDULE</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Bookings')}
                activeOpacity={0.8}
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {todaysBookings.map((booking, index) => (
              <TouchableOpacity
                key={booking.id || index}
                style={styles.scheduleCard}
                onPress={() => handleBookingPress(booking)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(200, 164, 93, 0.08)', 'rgba(200, 164, 93, 0.03)']}
                  style={styles.scheduleCardGradient}
                >
                  <View style={styles.scheduleCardContent}>
                    {/* Icon */}
                    <View style={styles.scheduleIconContainer}>
                      <Text style={styles.scheduleIcon}>
                        {getCategoryIcon(booking.activity_category)}
                      </Text>
                    </View>

                    {/* Details */}
                    <View style={styles.scheduleDetails}>
                      <Text style={styles.scheduleActivityName}>
                        {booking.activity_name}
                      </Text>
                      <View style={styles.scheduleTimeRow}>
                        <Text style={styles.scheduleTime}>
                          {formatBookingTime(booking.start_time)}
                        </Text>
                        <Text style={styles.scheduleDot}>•</Text>
                        <Text style={styles.scheduleDuration}>
                          {booking.activity_duration} min
                        </Text>
                      </View>
                      {booking.activity_type === 'journey' && booking.activity_stages && (
                        <Text style={styles.scheduleStages}>
                          {booking.activity_stages} stages
                        </Text>
                      )}
                    </View>

                    {/* Chevron */}
                    <View style={styles.scheduleChevron}>
                      <Text style={styles.scheduleChevronText}>›</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Terms & Conditions Notice Board */}
        <View style={styles.termsContainer}>
          <LinearGradient
            colors={['rgba(200, 164, 93, 0.08)', 'rgba(200, 164, 93, 0.03)']}
            style={styles.termsCard}
          >
            <View style={styles.termsHeader}>
              <View style={styles.termsIconContainer}>
                <Text style={styles.termsIcon}>ℹ️</Text>
              </View>
              <Text style={styles.termsTitle}>IMPORTANT NOTICE</Text>
            </View>

            <Text style={styles.termsText}>
              By using Faysha services, you acknowledge and agree to our Terms & Conditions,
              Privacy Policy, and House Rules. All guests must comply with estate guidelines
              for safety and comfort.
            </Text>

            <View style={styles.termsButtons}>
              <TouchableOpacity
                style={styles.termsButton}
                onPress={() => navigation.navigate('Terms')}
                activeOpacity={0.8}
              >
                <Text style={styles.termsButtonText}>Terms & Conditions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.termsButton}
                onPress={() => navigation.navigate('Privacy')}
                activeOpacity={0.8}
              >
                <Text style={styles.termsButtonText}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.termsDivider} />

            <View style={styles.termsFooter}>
              <Text style={styles.termsFooterText}>Emergency: +237 653 255 547</Text>
              <Text style={styles.termsSeparator}>•</Text>
              <Text style={styles.termsFooterText}>Concierge: +237 651 841 003</Text>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stayCard: { marginBottom: 24 },
  stayImage: { height: 170, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(200, 164, 93, 0.25)' },
  stayShade: { flex: 1, padding: 18, justifyContent: 'flex-end', borderRadius: 16 },
  stayInvite: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(200, 164, 93, 0.3)', padding: 20 },
  stayEyebrow: { fontSize: 10, letterSpacing: 2, color: COLORS.primary, marginBottom: 6, fontFamily: FONTS.body },
  stayName: { fontFamily: FONTS.heading, fontSize: 21, color: COLORS.text, letterSpacing: 0.6 },
  stayMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, fontFamily: FONTS.body },
  stayLinks: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  stayCta: { fontSize: 12, color: COLORS.primary, letterSpacing: 0.6, fontFamily: FONTS.body, marginTop: 10 },
  stayBadge: { fontSize: 11, color: COLORS.background, backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 22,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  greeting: {
    fontSize: 11,
    color: COLORS.textTertiary,
    letterSpacing: 1,
  },
  userName: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.text,
    marginTop: 2,
  },
  aiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  aiButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiButtonText: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E63946',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  moodQuestion: {
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 16,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  moodCard: {
    width: (width - 44 - 12) / 2,
    height: 110,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  moodCardBg: {
    width: '100%',
    height: '100%',
  },
  moodCardImage: {
    borderRadius: 10,
  },
  moodCardGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 10,
  },
  moodCardLabel: {
    fontFamily: FONTS.heading,
    fontSize: 15,
    letterSpacing: 1,
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.textTertiary,
    marginBottom: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionGlyph: {
    fontSize: 15,
    color: COLORS.primary,
  },
  quickActionLabel: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  companionCard: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.4)',
    borderRadius: 14,
    padding: 20,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  companionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  companionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  companionIconGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  companionIcon: {
    fontSize: 14,
    color: COLORS.background,
  },
  companionTitle: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    color: COLORS.primary,
  },
  companionBadge: {
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  companionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  companionText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    fontWeight: '400',
    marginBottom: 14,
  },
  companionCtaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companionCta: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  companionArrow: {
    fontSize: 16,
    color: COLORS.primary,
  },

  // Today's Schedule Section
  scheduleContainer: {
    marginTop: 32,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  viewAllText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  scheduleCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scheduleCardGradient: {
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    borderRadius: 12,
  },
  scheduleCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  scheduleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleIcon: {
    fontSize: 24,
  },
  scheduleDetails: {
    flex: 1,
    gap: 4,
  },
  scheduleActivityName: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  scheduleTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleTime: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  scheduleDot: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  scheduleDuration: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  scheduleStages: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  scheduleChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleChevronText: {
    fontSize: 18,
    color: COLORS.primary,
  },

  // Terms & Conditions Notice Board
  termsContainer: {
    marginTop: 32,
  },
  termsCard: {
    borderWidth: 1.5,
    borderColor: 'rgba(200, 164, 93, 0.4)',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  termsIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsIcon: {
    fontSize: 16,
  },
  termsTitle: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    color: COLORS.primary,
  },
  termsText: {
    fontSize: 12.5,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  termsButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  termsButton: {
    flex: 1,
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  termsButtonText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  termsDivider: {
    height: 1,
    backgroundColor: 'rgba(200, 164, 93, 0.2)',
    marginBottom: 14,
  },
  termsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  termsFooterText: {
    fontSize: 10.5,
    color: COLORS.textTertiary,
  },
  termsSeparator: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
});
