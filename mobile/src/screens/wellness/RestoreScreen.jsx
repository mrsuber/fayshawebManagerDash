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

// Journey stages for the Restore experience
const RESTORE_JOURNEY = [
  {
    id: 1,
    name: 'Massage Therapy',
    duration: '60 min',
    description: 'Begin your journey with restorative bodywork that releases tension and prepares your body for deep relaxation.',
    details: ['Deep tissue', 'Aromatherapy', 'Hot stone therapy'],
    icon: '✋',
  },
  {
    id: 2,
    name: 'Steam Room',
    duration: '20 min',
    description: 'Move into our cedar-lined steam sanctuary to loosen muscles and open your senses with aromatic oils.',
    details: ['Cedar-lined chamber', 'Aromatic eucalyptus', 'Purifying heat'],
    icon: '♨',
  },
  {
    id: 3,
    name: 'Cold Plunge',
    duration: '10 min',
    description: 'Complete your restoration with guided cold immersion to reduce inflammation and invigorate your entire system.',
    details: ['Supervised immersion', 'Recovery boost', 'Vital reset'],
    icon: '❄',
  },
];

export default function RestoreScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [expandedStage, setExpandedStage] = useState(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [restoreActivity, setRestoreActivity] = useState(null);
  const [restoreServices, setRestoreServices] = useState([]);
  const [selectedActivityToBook, setSelectedActivityToBook] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const moodData = MOOD_DATA.restore;

  useEffect(() => {
    // Entrance animation
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

    // Fetch Restore activity from unified system
    loadRestoreActivity();
  }, []);

  const loadRestoreActivity = async () => {
    try {
      setLoadingActivity(true);
      const response = await wellnessUnifiedService.getActivities({ category: 'restore' });

      // Handle case where response or response.activities is undefined
      if (!response || !response.activities) {
        console.warn('No activities data received from server');
        setRestoreActivity(null);
        setRestoreServices([]);
        return;
      }

      const activities = response.activities || [];

      // Find the main Restore journey
      const restore = activities.find(a => a.type === 'journey' && a.category === 'restore');
      setRestoreActivity(restore);

      // Find individual services (Massage Therapy, Steam Room, etc.)
      const services = activities.filter(a => a.type === 'service' && a.category === 'restore');
      setRestoreServices(services);
    } catch (error) {
      console.error('Error loading Restore activity:', error);
      Alert.alert('Error', 'Failed to load Restore journey details');
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleStagePress = (stageId) => {
    setExpandedStage(expandedStage === stageId ? null : stageId);
  };

  const handleBookJourney = () => {
    if (!restoreActivity) {
      Alert.alert('Error', 'Restore journey not available. Please try again.');
      return;
    }
    setSelectedActivityToBook(restoreActivity);
    setBookingModalVisible(true);
  };

  const handleBookIndividualService = (service) => {
    if (!service) {
      Alert.alert('Error', 'Service not available. Please try again.');
      return;
    }
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

  // Parallax effect for hero image
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
        {/* Hero Section with Parallax */}
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
            {/* Green gradient overlay */}
            <LinearGradient
              colors={[
                'rgba(122, 174, 138, 0.15)',
                'rgba(74, 124, 89, 0.45)',
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
                {/* Decorative element */}
                <View style={styles.decorativeLine} />

                {/* Main title */}
                <Text style={styles.heroTitle}>RESTORE</Text>

                {/* Tagline */}
                <Text style={styles.heroTagline}>{moodData.tagline}</Text>

                {/* Decorative element */}
                <View style={styles.decorativeLine} />
              </Animated.View>
            </LinearGradient>
          </ImageBackground>
        </Animated.View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Journey Introduction */}
          <View style={styles.journeyIntro}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionTitle}>THE RESTORE JOURNEY</Text>
              <View style={styles.sectionDivider} />
            </View>

            <Text style={styles.journeyDescription}>
              A complete restoration experience in three carefully sequenced stages.
              Each phase builds upon the last, guiding your body through release, purification, and renewal.
            </Text>

            {/* Duration Badge */}
            <View style={styles.durationBadge}>
              <View style={styles.durationIconBox}>
                <Text style={styles.durationIcon}>⏱</Text>
              </View>
              <View style={styles.durationInfo}>
                <Text style={styles.durationLabel}>Total Journey</Text>
                <Text style={styles.durationValue}>90 minutes</Text>
              </View>
            </View>
          </View>

          {/* Journey Timeline */}
          <View style={styles.journeyTimeline}>
            {RESTORE_JOURNEY.map((stage, index) => (
              <View key={stage.id} style={styles.stageWrapper}>
                {/* Connection Line */}
                {index < RESTORE_JOURNEY.length - 1 && (
                  <View style={styles.connectionLine} />
                )}

                {/* Stage Card */}
                <TouchableOpacity
                  style={[
                    styles.stageCard,
                    expandedStage === stage.id && styles.stageCardExpanded,
                  ]}
                  onPress={() => handleStagePress(stage.id)}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={
                      expandedStage === stage.id
                        ? ['rgba(127, 174, 138, 0.15)', 'rgba(74, 124, 89, 0.15)']
                        : ['rgba(13, 13, 13, 0.4)', 'rgba(13, 13, 13, 0.6)']
                    }
                    style={styles.stageGradient}
                  >
                    {/* Stage Header */}
                    <View style={styles.stageHeader}>
                      {/* Stage Number Circle */}
                      <View style={styles.stageNumberCircle}>
                        <Text style={styles.stageNumber}>{stage.id}</Text>
                      </View>

                      {/* Stage Icon */}
                      <View style={styles.stageIconBox}>
                        <Text style={styles.stageIcon}>{stage.icon}</Text>
                      </View>

                      {/* Stage Info */}
                      <View style={styles.stageInfo}>
                        <Text style={styles.stageName}>{stage.name}</Text>
                        <Text style={styles.stageDuration}>{stage.duration}</Text>
                      </View>

                      {/* Expand Icon */}
                      <View style={styles.expandIcon}>
                        <Text style={styles.expandIconText}>
                          {expandedStage === stage.id ? '−' : '+'}
                        </Text>
                      </View>
                    </View>

                    {/* Stage Details (Expanded) */}
                    {expandedStage === stage.id && (
                      <View style={styles.stageDetails}>
                        <Text style={styles.stageDescription}>
                          {stage.description}
                        </Text>

                        <View style={styles.stageFeatures}>
                          {stage.details.map((detail, idx) => (
                            <View key={idx} style={styles.featureRow}>
                              <Text style={styles.featureBullet}>✓</Text>
                              <Text style={styles.featureText}>{detail}</Text>
                            </View>
                          ))}
                        </View>

                        {/* Book Individual Service Button */}
                        {(() => {
                          // Find matching service from backend
                          const matchingService = restoreServices.find(
                            s => s.name && s.name.toLowerCase().includes(stage.name.toLowerCase().split(' ')[0])
                          );

                          if (matchingService) {
                            return (
                              <TouchableOpacity
                                style={styles.bookStageButton}
                                onPress={() => handleBookIndividualService(matchingService)}
                                activeOpacity={0.8}
                              >
                                <LinearGradient
                                  colors={['rgba(127, 174, 138, 0.25)', 'rgba(74, 124, 89, 0.25)']}
                                  style={styles.bookStageGradient}
                                >
                                  <Text style={styles.bookStageText}>Book {stage.name} Only</Text>
                                  <Text style={styles.bookStageArrow}>→</Text>
                                </LinearGradient>
                              </TouchableOpacity>
                            );
                          }
                          return null;
                        })()}
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Access Information */}
          <View style={styles.accessInfoCard}>
            <LinearGradient
              colors={['rgba(200, 164, 93, 0.1)', 'rgba(200, 164, 93, 0.05)']}
              style={styles.accessGradient}
            >
              <View style={styles.accessHeader}>
                <Text style={styles.accessIcon}>🔑</Text>
                <Text style={styles.accessTitle}>Journey Access</Text>
              </View>
              <Text style={styles.accessText}>
                Your booking confirmation will include a unique PIN code visible on your Digital Key screen.
                Use this PIN to access each stage of your journey. Our system tracks your progress automatically
                as you move through each phase.
              </Text>
              <TouchableOpacity
                style={styles.viewKeyButton}
                onPress={() => navigation.navigate('DigitalKey')}
                activeOpacity={0.8}
              >
                <Text style={styles.viewKeyText}>View Digital Key</Text>
                <Text style={styles.viewKeyArrow}>→</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Book Journey CTA */}
          <TouchableOpacity
            style={styles.bookButton}
            onPress={handleBookJourney}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#7fae8a', '#4a7c59']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bookButtonGradient}
            >
              <Text style={styles.bookButtonText}>BEGIN YOUR JOURNEY</Text>
              <View style={styles.bookButtonIcon}>
                <Text style={styles.bookButtonIconText}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </View>
      </Animated.ScrollView>

      {/* Booking Modal */}
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
        subtitle="Your Restore Journey awaits"
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

  // Hero Section
  heroContainer: {
    height: height * 0.5,
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
    backgroundColor: '#7fae8a',
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

  // Content Section
  contentSection: {
    paddingHorizontal: 22,
    marginTop: -40,
  },

  // Journey Introduction
  journeyIntro: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
  },
  sectionDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(127, 174, 138, 0.3)',
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2.5,
    color: '#7fae8a',
    fontWeight: '700',
  },
  journeyDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(242, 233, 216, 0.8)',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127, 174, 138, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.3)',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  durationIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(127, 174, 138, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationIcon: {
    fontSize: 20,
  },
  durationInfo: {
    gap: 2,
  },
  durationLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    letterSpacing: 0.5,
  },
  durationValue: {
    fontSize: 16,
    color: '#7fae8a',
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Journey Timeline
  journeyTimeline: {
    marginBottom: 28,
  },
  stageWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  connectionLine: {
    position: 'absolute',
    left: 22,
    top: 70,
    width: 2,
    height: 30,
    backgroundColor: 'rgba(127, 174, 138, 0.3)',
    zIndex: -1,
  },
  stageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.2)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  stageCardExpanded: {
    borderColor: 'rgba(127, 174, 138, 0.5)',
    shadowColor: '#7fae8a',
    shadowOpacity: 0.25,
  },
  stageGradient: {
    padding: 18,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stageNumberCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(127, 174, 138, 0.25)',
    borderWidth: 2,
    borderColor: '#7fae8a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7fae8a',
  },
  stageIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(127, 174, 138, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageIcon: {
    fontSize: 24,
  },
  stageInfo: {
    flex: 1,
    gap: 4,
  },
  stageName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  stageDuration: {
    fontSize: 12,
    color: 'rgba(127, 174, 138, 0.9)',
    letterSpacing: 0.5,
  },
  expandIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(127, 174, 138, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandIconText: {
    fontSize: 20,
    color: '#7fae8a',
    fontWeight: '300',
  },

  // Stage Details (Expanded)
  stageDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(127, 174, 138, 0.2)',
    gap: 14,
  },
  stageDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(242, 233, 216, 0.8)',
  },
  stageFeatures: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureBullet: {
    fontSize: 14,
    color: '#7fae8a',
    fontWeight: '700',
  },
  featureText: {
    fontSize: 13,
    color: 'rgba(242, 233, 216, 0.75)',
    flex: 1,
  },

  // Book Individual Stage Button
  bookStageButton: {
    marginTop: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.4)',
  },
  bookStageGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  bookStageText: {
    fontSize: 12,
    color: '#7fae8a',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bookStageArrow: {
    fontSize: 14,
    color: '#7fae8a',
  },

  // Access Info Card
  accessInfoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  accessGradient: {
    padding: 20,
  },
  accessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  accessIcon: {
    fontSize: 24,
  },
  accessTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  accessText: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(242, 233, 216, 0.75)',
    marginBottom: 16,
  },
  viewKeyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.4)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  viewKeyText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  viewKeyArrow: {
    fontSize: 14,
    color: COLORS.primary,
  },

  // Book Button
  bookButton: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#7fae8a',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 28,
    gap: 12,
  },
  bookButtonText: {
    fontSize: 13,
    letterSpacing: 2.5,
    color: COLORS.background,
    fontWeight: '700',
  },
  bookButtonIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonIconText: {
    fontSize: 15,
    color: COLORS.background,
    fontWeight: '600',
  },

  bottomSpacing: {
    height: 40,
  },
});
