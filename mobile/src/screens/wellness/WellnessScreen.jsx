import React, { useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '../../constants/theme';
import { MOOD_DATA } from '../../constants/wellnessData';
import { WELLNESS_IMAGES } from '../../constants/images';
import wellnessUnifiedService from '../../services/wellnessUnifiedService';

const { width } = Dimensions.get('window');

export default function WellnessScreen({ navigation }) {
  const [todaysBookings, setTodaysBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  // The guest's own wellness activity, from their bookings (no invented scores).
  const [stats, setStats] = useState({ upcoming: 0, completed: 0, minutes: 0, next: null });

  // Fetch today's bookings from backend
  const fetchTodaysBookings = async () => {
    try {
      setLoadingBookings(true);
      const response = await wellnessUnifiedService.getMyBookings();

      if (response && response.bookings) {
        const all = response.bookings;
        const done = all.filter((b) => b.status === 'completed');
        const ahead = all
          .filter((b) => b.status === 'upcoming' || b.status === 'in_progress')
          .sort((a, b) => `${a.booking_date} ${a.start_time}`.localeCompare(`${b.booking_date} ${b.start_time}`));
        setStats({
          upcoming: ahead.length,
          completed: done.length,
          minutes: done.reduce((sum, b) => sum + (Number(b.total_duration) || 0), 0),
          next: ahead[0] || null,
        });

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

        console.log('📅 [WellnessScreen] Today\'s bookings:', todayOnly.length);
        setTodaysBookings(todayOnly);
      }
    } catch (error) {
      console.error('[WellnessScreen] Error fetching today\'s bookings:', error);
      setTodaysBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Fetch bookings when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🏥 Wellness screen focused, refreshing bookings...');
      fetchTodaysBookings();
    }, [])
  );

  const handleMoodPress = (moodKey) => {
    if (moodKey === 'restore') {
      navigation.navigate('Restore');
    } else if (moodKey === 'recharge') {
      navigation.navigate('Recharge');
    } else if (moodKey === 'reflect') {
      navigation.navigate('Reflect');
    } else if (moodKey === 'explore') {
      navigation.navigate('ExploreMood');
    }
  };

  const handleSessionPress = (booking) => {
    // Navigate to bookings screen with the specific booking
    navigation.navigate('Bookings', { bookingId: booking.id });
  };

  const handleViewRecommendations = () => {
    // Navigate to personalized recommendations
    navigation.navigate('MoodHub', { moodKey: 'restore' });
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

  const getCategoryImage = (category) => {
    const images = {
      'restore': WELLNESS_IMAGES.spa,
      'recharge': WELLNESS_IMAGES.gym,
      'reflect': WELLNESS_IMAGES.sunset,
      'explore': WELLNESS_IMAGES.explore,
      'spa': WELLNESS_IMAGES.spa,
      'fitness': WELLNESS_IMAGES.gym,
      'dining': WELLNESS_IMAGES.dining,
    };
    return images[category?.toLowerCase()] || WELLNESS_IMAGES.spa;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.heading}>Your Wellness</Text>
          <Text style={styles.subheading}>Personalized journey to wellbeing</Text>
        </View>

        {/* Your wellness, from real bookings */}
        <LinearGradient
          colors={['rgba(200, 164, 93, 0.12)', 'rgba(200, 164, 93, 0.05)']}
          style={styles.scoreCard}
        >
          <Text style={styles.scoreCardTitle}>{stats.next ? 'YOUR NEXT RITUAL' : 'BEGIN YOUR RITUAL'}</Text>
          {stats.next ? (
            <TouchableOpacity onPress={() => navigation.navigate('Bookings')} activeOpacity={0.85} style={{ alignItems: 'center', marginVertical: 18 }}>
              <Text style={styles.nextName}>{stats.next.activity_name}</Text>
              <Text style={styles.nextWhen}>
                {stats.next.booking_date === new Date().toISOString().slice(0, 10) ? 'Today' : new Date(`${stats.next.booking_date}T00:00:00`).toDateString().slice(0, 10)}
                {stats.next.start_time ? ` · ${String(stats.next.start_time).slice(0, 5)}` : ''}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.nextEmpty}>Choose how you'd like to feel below — restore, recharge, reflect or explore — and book your first session.</Text>
          )}

          <View style={styles.quickMetrics}>
            {[
              { label: 'Upcoming', value: stats.upcoming },
              { label: 'Completed', value: stats.completed },
              { label: 'Minutes', value: stats.minutes },
            ].map((metric) => (
              <View key={metric.label} style={styles.quickMetricItem}>
                <Text style={styles.quickMetricValue}>{metric.value}</Text>
                <Text style={styles.quickMetricLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Journey Bookings Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Bookings')}
          activeOpacity={0.85}
          style={styles.journeyBookingsButton}
        >
          <LinearGradient
            colors={['rgba(200, 164, 93, 0.12)', 'rgba(200, 164, 93, 0.25)']}
            style={styles.journeyBookingsGradient}
          >
            <View style={styles.journeyBookingsContent}>
              <View style={styles.journeyBookingsLeft}>
                <Text style={styles.journeyBookingsTitle}>My Wellness Journey Bookings</Text>
                <Text style={styles.journeyBookingsSubtitle}>View your completed & upcoming sessions</Text>
              </View>
              <Ionicons name="calendar-outline" size={28} color={COLORS.primary} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Today's Schedule */}
        {todaysBookings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TODAY'S SCHEDULE</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Bookings')}>
                <Text style={styles.sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>

            {todaysBookings.map((booking) => (
              <TouchableOpacity
                key={booking.id}
                style={styles.sessionCard}
                onPress={() => handleSessionPress(booking)}
                activeOpacity={0.85}
              >
                <ImageBackground
                  source={getCategoryImage(booking.activity_category)}
                  style={styles.sessionImage}
                  imageStyle={styles.sessionImageStyle}
                >
                  <LinearGradient
                    colors={['rgba(13, 13, 13, 0.3)', 'rgba(13, 13, 13, 0.85)']}
                    style={styles.sessionGradient}
                  >
                    <View style={styles.sessionBadge}>
                      <Text style={styles.sessionBadgeText}>
                        {booking.activity_category?.toUpperCase() || 'WELLNESS'}
                      </Text>
                    </View>
                  </LinearGradient>
                </ImageBackground>

                <View style={styles.sessionInfo}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionName}>{booking.activity_name}</Text>
                    <Text style={styles.sessionTime}>{formatBookingTime(booking.start_time)}</Text>
                  </View>
                  <View style={styles.sessionDetails}>
                    <View style={styles.sessionDetail}>
                      <Text style={styles.detailIcon}>⏱</Text>
                      <Text style={styles.detailText}>{booking.activity_duration} min</Text>
                    </View>
                    {booking.activity_location && (
                      <View style={styles.sessionDetail}>
                        <Text style={styles.detailIcon}>📍</Text>
                        <Text style={styles.detailText}>{booking.activity_location}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Wellness Zones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WELLNESS ZONES</Text>

          <View style={styles.zonesGrid}>
            {Object.keys(MOOD_DATA).map((moodKey) => {
              const mood = MOOD_DATA[moodKey];
              return (
                <TouchableOpacity
                  key={moodKey}
                  style={styles.zoneCard}
                  onPress={() => handleMoodPress(moodKey)}
                  activeOpacity={0.85}
                >
                  <ImageBackground
                    source={mood.img}
                    style={styles.zoneImage}
                    imageStyle={styles.zoneImageStyle}
                  >
                    <LinearGradient
                      colors={['rgba(13, 13, 13, 0.2)', 'rgba(13, 13, 13, 0.85)']}
                      style={styles.zoneGradient}
                    >
                      <Text style={styles.zoneLabel}>{mood.label}</Text>
                      <Text style={styles.zoneTagline} numberOfLines={2}>
                        {mood.tagline}
                      </Text>
                    </LinearGradient>
                  </ImageBackground>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Recommendations Button */}
        <TouchableOpacity
          onPress={handleViewRecommendations}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#C8A45D', '#D68910']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.recommendButton}
          >
            <Text style={styles.recommendButtonText}>RECOMMENDATIONS</Text>
            <View style={styles.recommendButtonIcon}>
              <Text style={styles.recommendButtonIconText}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

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
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 24,
  },
  heading: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    color: COLORS.text,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Wellness Score Card
  nextName: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.text, textAlign: 'center', letterSpacing: 0.6 },
  nextWhen: { fontSize: 13, color: COLORS.primary, marginTop: 6, letterSpacing: 0.6 },
  nextEmpty: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19.5, marginVertical: 18, paddingHorizontal: 6 },
  scoreCard: {
    marginHorizontal: 22,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    marginBottom: 28,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  scoreCardTitle: {
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreCircleOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    borderColor: 'rgba(200, 164, 93, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scoreCircleProgress: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 176,
    height: 176,
    borderRadius: 88,
    opacity: 0.9,
  },
  scoreCircleInner: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
  },
  scoreNumber: {
    fontFamily: FONTS.heading,
    fontSize: 42,
    color: COLORS.text,
  },
  scoreLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primary,
    marginTop: 4,
  },
  quickMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200, 164, 93, 0.2)',
  },
  quickMetricItem: {
    alignItems: 'center',
  },
  quickMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  quickMetricLabel: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },

  // Section
  section: {
    paddingHorizontal: 22,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.textTertiary,
    fontWeight: '700',
  },
  sectionLink: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Session Cards
  sessionCard: {
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sessionImage: {
    height: 90,
  },
  sessionImageStyle: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  sessionGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'flex-end',
  },
  sessionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(200, 164, 93, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sessionBadgeText: {
    fontSize: 8,
    letterSpacing: 1,
    color: COLORS.background,
    fontWeight: '700',
  },
  sessionInfo: {
    padding: 14,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sessionName: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
  },
  sessionTime: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  sessionDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  sessionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailIcon: {
    fontSize: 12,
  },
  detailText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  // Wellness Zones Grid
  zonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  zoneCard: {
    width: (width - 44 - 12) / 2,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  zoneImage: {
    flex: 1,
  },
  zoneImageStyle: {
    borderRadius: 12,
  },
  zoneGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  zoneLabel: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 4,
  },
  zoneTagline: {
    fontSize: 10,
    color: 'rgba(242, 233, 216, 0.7)',
    lineHeight: 14,
  },

  // Detailed Metrics
  metricsContainer: {
    gap: 12,
  },
  metricCard: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.2)',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Recommendations Button
  recommendButton: {
    marginHorizontal: 22,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  recommendButtonText: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.background,
    fontWeight: '700',
  },
  recommendButtonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendButtonIconText: {
    fontSize: 14,
    color: COLORS.background,
    fontWeight: 'bold',
  },

  bottomSpacing: {
    height: 20,
  },

  // Journey Bookings Button
  journeyBookingsButton: {
    marginHorizontal: 22,
    marginBottom: 28,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  journeyBookingsGradient: {
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    borderRadius: 16,
  },
  journeyBookingsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  journeyBookingsLeft: {
    flex: 1,
    marginRight: 12,
  },
  journeyBookingsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  journeyBookingsSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
