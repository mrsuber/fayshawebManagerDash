import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import { MOOD_DATA } from '../../constants/wellnessData';
import BookingModalUnified from '../../components/BookingModalUnified';
import PremiumModal from '../../components/PremiumModal';
import wellnessUnifiedService from '../../services/wellnessUnifiedService';

const { width, height } = Dimensions.get('window');

// Recharge color theme - Energy orange/red
const RECHARGE_COLORS = {
  primary: '#FF6B35',
  secondary: '#D84315',
  accent: '#FFB347',
};

export default function RechargeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [rechargeActivity, setRechargeActivity] = useState(null);
  const [rechargeServices, setRechargeServices] = useState([]);
  const [selectedActivityToBook, setSelectedActivityToBook] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const moodData = MOOD_DATA.recharge;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Fetch Recharge activity from unified system
    loadRechargeActivity();
  }, []);

  const loadRechargeActivity = async () => {
    try {
      setLoadingActivity(true);
      console.log('🔄 [RechargeScreen] Loading recharge activities from backend...');

      const response = await wellnessUnifiedService.getActivities({ category: 'recharge' });

      console.log('📦 [RechargeScreen] Backend response:', JSON.stringify(response, null, 2));

      // Handle case where response or response.activities is undefined
      if (!response || !response.activities) {
        console.warn('❌ [RechargeScreen] No activities data received from server');
        setRechargeActivity(null);
        setRechargeServices([]);
        return;
      }

      const activities = response.activities || [];
      console.log(`✅ [RechargeScreen] Received ${activities.length} activities from backend:`,
        activities.map(a => `${a.name} (${a.type}, ID: ${a.id})`));

      // Find the main Recharge journey
      const recharge = activities.find(a => a.type === 'journey' && a.category === 'recharge');
      console.log('🎯 [RechargeScreen] Journey found:', recharge ? `${recharge.name} (ID: ${recharge.id})` : 'NONE');
      setRechargeActivity(recharge);

      // Find individual services
      const services = activities.filter(a => a.type === 'service' && a.category === 'recharge');
      console.log(`🏋️ [RechargeScreen] Services found: ${services.length}`,
        services.map(s => `${s.name} (ID: ${s.id})`));
      setRechargeServices(services);
    } catch (error) {
      console.error('❌ [RechargeScreen] Error loading Recharge activity:', error);
      Alert.alert('Error', 'Failed to load Recharge journey details');
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleActivityPress = (activity, matchingService = null) => {
    navigation.navigate('Detail', {
      title: activity.name,
      subtitle: moodData.label,
      img: activity.img,
      description: activity.desc,
      features: activity.features,
      activityId: matchingService?.id, // Pass the backend service ID if found
    });
  };

  const handleBookSession = () => {
    if (!rechargeActivity) {
      Alert.alert('Error', 'Recharge journey not available. Please try again.');
      return;
    }
    setSelectedActivityToBook(rechargeActivity);
    setBookingModalVisible(true);
  };

  const handleBookIndividualService = (service) => {
    console.log('📌 [RechargeScreen] handleBookIndividualService called with service:', JSON.stringify(service, null, 2));

    if (!service) {
      Alert.alert('Error', 'Service not available. Please try again.');
      return;
    }

    console.log('📌 [RechargeScreen] Service details:', {
      id: service.id,
      name: service.name,
      type: service.type,
      category: service.category,
      duration: service.duration,
      has_stages: service.has_stages,
      total_stages: service.total_stages
    });

    setSelectedActivityToBook(service);
    setBookingModalVisible(true);
  };

  const handleBookingModalClose = (bookingConfirmed) => {
    setBookingModalVisible(false);

    if (bookingConfirmed) {
      // Show premium success modal
      setSuccessModalVisible(true);
    }
  };

  const heroTranslate = scrollY.interpolate({
    inputRange: [0, 300],
    outputRange: [0, -100],
    extrapolate: 'clamp',
  });

  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 200, 300],
    outputRange: [1, 0.8, 0.6],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        <Animated.View
          style={[
            styles.heroContainer,
            {
              transform: [{ translateY: heroTranslate }],
              opacity: heroOpacity,
            },
          ]}
        >
          <ImageBackground
            source={moodData.img}
            style={styles.heroImage}
            imageStyle={styles.heroImageStyle}
          >
            <LinearGradient
              colors={[
                'rgba(255, 107, 53, 0.15)',
                'rgba(216, 67, 21, 0.45)',
                'rgba(13, 13, 13, 0.85)',
              ]}
              style={styles.heroGradient}
            >
              <Animated.View
                style={[
                  styles.heroContent,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={[styles.decorativeLine, { backgroundColor: RECHARGE_COLORS.primary }]} />
                <Text style={styles.heroTitle}>RECHARGE</Text>
                <Text style={styles.heroTagline}>{moodData.tagline}</Text>
                <View style={[styles.decorativeLine, { backgroundColor: RECHARGE_COLORS.primary }]} />
              </Animated.View>
            </LinearGradient>
          </ImageBackground>
        </Animated.View>

        <View style={styles.contentSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDivider} />
            <Text style={[styles.sectionTitle, { color: RECHARGE_COLORS.primary }]}>
              YOUR JOURNEY
            </Text>
            <View style={styles.sectionDivider} />
          </View>

          {moodData.activities.length > 0 && (
            <TouchableOpacity
              style={styles.featuredCard}
              onPress={() => handleActivityPress(moodData.activities[0])}
              activeOpacity={0.9}
            >
              <ImageBackground
                source={moodData.activities[0].img}
                style={styles.featuredImage}
                imageStyle={styles.featuredImageStyle}
              >
                <LinearGradient
                  colors={[
                    'rgba(13, 13, 13, 0.3)',
                    'rgba(13, 13, 13, 0.7)',
                    'rgba(13, 13, 13, 0.95)',
                  ]}
                  style={styles.featuredGradient}
                >
                  <View style={[styles.featuredBadge, { backgroundColor: RECHARGE_COLORS.primary }]}>
                    <Text style={styles.featuredBadgeText}>FEATURED</Text>
                  </View>

                  <View style={styles.featuredContent}>
                    <Text style={styles.featuredName}>
                      {moodData.activities[0].name}
                    </Text>
                    <Text style={[styles.featuredTime, { color: RECHARGE_COLORS.accent }]}>
                      {moodData.activities[0].time}
                    </Text>
                    <Text style={styles.featuredDesc} numberOfLines={2}>
                      {moodData.activities[0].desc}
                    </Text>

                    <View style={styles.featuredCTA}>
                      <Text style={[styles.featuredCTAText, { color: RECHARGE_COLORS.primary }]}>
                        DISCOVER MORE
                      </Text>
                      <Text style={[styles.featuredArrow, { color: RECHARGE_COLORS.primary }]}>
                        →
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          )}

          <View style={styles.experiencesSection}>
            <Text style={styles.experiencesTitle}>ALL EXPERIENCES</Text>

            {/* Show hardcoded UI activities for information */}
            {moodData.activities.slice(1).map((activity, index) => {
              // Try to find matching backend service with improved matching
              const activityNameLower = activity.name.toLowerCase();
              const matchingService = rechargeServices.find(s => {
                if (!s.name) return false;
                const serviceName = s.name.toLowerCase();

                // Exact match
                if (serviceName === activityNameLower) return true;

                // Partial match (either contains the other)
                if (serviceName.includes(activityNameLower) || activityNameLower.includes(serviceName)) return true;

                // Keyword matching for common variations
                if ((activityNameLower.includes('personal') || activityNameLower.includes('trainer')) &&
                    (serviceName.includes('personal') || serviceName.includes('trainer') || serviceName.includes('training'))) {
                  return true;
                }
                if ((activityNameLower.includes('gym') || activityNameLower.includes('training')) &&
                    (serviceName.includes('gym') || serviceName.includes('training') || serviceName.includes('fitness'))) {
                  return true;
                }

                return false;
              });

              return (
                <View key={index} style={styles.activityCardContainer}>
                  <TouchableOpacity
                    style={styles.activityCard}
                    onPress={() => handleActivityPress(activity, matchingService)}
                    activeOpacity={0.85}
                  >
                    <ImageBackground
                      source={activity.img}
                      style={styles.activityImage}
                      imageStyle={styles.activityImageStyle}
                    >
                      <LinearGradient
                        colors={[
                          'rgba(13, 13, 13, 0.2)',
                          'rgba(13, 13, 13, 0.8)',
                        ]}
                        style={styles.activityGradient}
                      >
                        <View style={styles.activityContent}>
                          <Text style={styles.activityName}>{activity.name}</Text>
                          <Text style={[styles.activityTime, { color: RECHARGE_COLORS.accent }]}>
                            {activity.time}
                          </Text>
                        </View>

                        {matchingService ? (
                          <TouchableOpacity
                            style={[styles.activityChevron, styles.activityBookButton, {
                              backgroundColor: `${RECHARGE_COLORS.primary}`,
                              borderColor: `${RECHARGE_COLORS.primary}`
                            }]}
                            onPress={() => handleBookIndividualService(matchingService)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.activityChevronText, { color: COLORS.background, fontSize: 11, fontWeight: '700' }]}>
                              BOOK
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.activityChevron, {
                            backgroundColor: `${RECHARGE_COLORS.primary}33`,
                            borderColor: `${RECHARGE_COLORS.primary}66`
                          }]}>
                            <Text style={[styles.activityChevronText, { color: RECHARGE_COLORS.primary }]}>
                              ›
                            </Text>
                          </View>
                        )}
                      </LinearGradient>
                    </ImageBackground>
                    <View style={[styles.cardAccent, { backgroundColor: RECHARGE_COLORS.primary }]} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.bookButton}
            onPress={handleBookSession}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[RECHARGE_COLORS.primary, RECHARGE_COLORS.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bookButtonGradient}
            >
              <Text style={styles.bookButtonText}>BOOK A SESSION</Text>
              <View style={styles.bookButtonIcon}>
                <Text style={styles.bookButtonIconText}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.bottomSpacing} />
        </View>
      </Animated.ScrollView>

      {/* Booking Modal - Unified System */}
      {selectedActivityToBook && (
        <BookingModalUnified
          visible={bookingModalVisible}
          onClose={handleBookingModalClose}
          activity={selectedActivityToBook}
        />
      )}

      {/* Success Modal */}
      <PremiumModal
        visible={successModalVisible}
        type="success"
        title="Booking Confirmed!"
        subtitle="Your Recharge Journey awaits"
        message="Your session has been scheduled. A journey PIN will be sent to your Digital Key for access to each stage."
        primaryButtonText="Got it"
        onClose={() => setSuccessModalVisible(false)}
      />
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
    paddingBottom: 40,
  },
  heroContainer: {
    height: height * 0.55,
    width: width,
  },
  heroImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  heroImageStyle: {
    resizeMode: 'cover',
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  heroContent: {
    alignItems: 'center',
  },
  decorativeLine: {
    width: 60,
    height: 1,
    marginVertical: 20,
  },
  heroTitle: {
    fontFamily: FONTS.heading,
    fontSize: 38,
    letterSpacing: 6,
    color: COLORS.text,
    textAlign: 'center',
  },
  heroTagline: {
    fontSize: 15,
    color: 'rgba(242, 233, 216, 0.75)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginTop: 12,
  },
  contentSection: {
    paddingHorizontal: 22,
    marginTop: -40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
  },
  sectionDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(200, 164, 93, 0.3)',
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
  },
  featuredCard: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  featuredImage: {
    flex: 1,
  },
  featuredImageStyle: {
    borderRadius: 16,
  },
  featuredGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  featuredBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  featuredBadgeText: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.background,
    fontWeight: '700',
  },
  featuredContent: {
    gap: 6,
  },
  featuredName: {
    fontFamily: FONTS.heading,
    fontSize: 26,
    color: COLORS.text,
    letterSpacing: 1,
  },
  featuredTime: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  featuredDesc: {
    fontSize: 13,
    color: 'rgba(242, 233, 216, 0.7)',
    lineHeight: 19,
    marginTop: 4,
  },
  featuredCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  featuredCTAText: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  featuredArrow: {
    fontSize: 16,
  },
  experiencesSection: {
    gap: 12,
  },
  experiencesTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.textTertiary,
    marginBottom: 8,
  },
  activityCardContainer: {
    marginBottom: 12,
  },
  activityCard: {
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  activityImage: {
    flex: 1,
  },
  activityImageStyle: {
    borderRadius: 12,
  },
  activityGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 11.5,
  },
  activityChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityChevronText: {
    fontSize: 20,
  },
  activityBookButton: {
    width: 60,
    paddingHorizontal: 8,
  },
  cardAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  bookButton: {
    marginTop: 28,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: RECHARGE_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  bookButtonText: {
    fontSize: 13,
    letterSpacing: 2,
    color: COLORS.background,
    fontWeight: '700',
  },
  bookButtonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonIconText: {
    fontSize: 14,
    color: COLORS.background,
  },
  bottomSpacing: {
    height: 40,
  },
});
