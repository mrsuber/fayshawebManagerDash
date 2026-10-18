import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';
import BookingModalUnified from '../../components/BookingModalUnified';
import wellnessUnifiedService from '../../services/wellnessUnifiedService';

export default function DetailScreen({ route, navigation }) {
  const { title, subtitle, img, description, features, activityId } = route.params;
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [activity, setActivity] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Fetch activity details if activityId is provided
  useEffect(() => {
    if (activityId) {
      loadActivityDetails();
    } else {
      // If no activityId, try to fetch based on category
      loadActivityByCategory();
    }
  }, [activityId]);

  const loadActivityDetails = async () => {
    try {
      setLoadingActivity(true);
      const response = await wellnessUnifiedService.getActivityById(activityId);
      setActivity(response.activity);
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoadingActivity(false);
    }
  };

  const loadActivityByCategory = async () => {
    try {
      setLoadingActivity(true);
      const category = subtitle?.toLowerCase();
      if (!category) return;

      const response = await wellnessUnifiedService.getActivities({ category });
      if (response.activities && response.activities.length > 0) {
        const titleLower = title.toLowerCase();
        console.log(`📍 DetailScreen: Looking for "${title}" in category "${category}"`);
        console.log(`📍 Available activities:`, response.activities.map(a => `${a.name} (${a.type})`));

        // Enhanced matching logic - try multiple strategies
        let matchingActivity = null;

        // Strategy 1: Exact match by name
        matchingActivity = response.activities.find(a =>
          a.name.toLowerCase() === titleLower
        );

        // Strategy 2: Partial match - title contains activity name OR activity name contains title
        if (!matchingActivity) {
          matchingActivity = response.activities.find(a =>
            a.name.toLowerCase().includes(titleLower) ||
            titleLower.includes(a.name.toLowerCase())
          );
        }

        // Strategy 3: Keyword-based matching for common services
        if (!matchingActivity) {
          // Personal Trainer / Training / Gym
          if (titleLower.includes('personal') || titleLower.includes('trainer') ||
              titleLower.includes('gym') || titleLower.includes('training')) {
            matchingActivity = response.activities.find(a =>
              a.type === 'service' && (
                a.name.toLowerCase().includes('personal') ||
                a.name.toLowerCase().includes('trainer') ||
                a.name.toLowerCase().includes('gym') ||
                a.name.toLowerCase().includes('training') ||
                a.name.toLowerCase().includes('fitness')
              )
            );
          }
          // Massage
          else if (titleLower.includes('massage')) {
            matchingActivity = response.activities.find(a =>
              a.type === 'service' && a.name.toLowerCase().includes('massage')
            );
          }
          // Steam Room
          else if (titleLower.includes('steam')) {
            matchingActivity = response.activities.find(a =>
              a.type === 'service' && a.name.toLowerCase().includes('steam')
            );
          }
          // Yoga
          else if (titleLower.includes('yoga')) {
            matchingActivity = response.activities.find(a =>
              a.type === 'service' && a.name.toLowerCase().includes('yoga')
            );
          }
          // Meditation
          else if (titleLower.includes('meditation')) {
            matchingActivity = response.activities.find(a =>
              a.type === 'service' && a.name.toLowerCase().includes('meditation')
            );
          }
        }

        // Strategy 4: If still no match, prefer services over journeys
        if (!matchingActivity) {
          matchingActivity = response.activities.find(a => a.type === 'service');
        }

        // Strategy 5: Fall back to journey type
        if (!matchingActivity) {
          matchingActivity = response.activities.find(a => a.type === 'journey');
        }

        // Last resort: use first activity
        if (!matchingActivity) {
          matchingActivity = response.activities[0];
        }

        console.log(`✅ DetailScreen: Matched "${title}" to activity: "${matchingActivity?.name}" (${matchingActivity?.type})`);
        setActivity(matchingActivity);
      }
    } catch (error) {
      console.error('Error loading activity by category:', error);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleBook = () => {
    if (!activity) {
      Alert.alert('Error', 'Activity details not available. Please try again.');
      return;
    }
    setBookingModalVisible(true);
  };

  const handleBookingModalClose = (bookingConfirmed) => {
    setBookingModalVisible(false);

    if (bookingConfirmed) {
      Alert.alert(
        'Booking Confirmed!',
        `Your ${title} booking has been scheduled. Check your Digital Key for access details.`,
        [
          {
            text: 'View Bookings',
            onPress: () => navigation.navigate('Bookings'),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero Image */}
        <Image source={img} style={styles.heroImage} />

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.description}>{description}</Text>

          {/* Features */}
          <View style={styles.featuresContainer}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Book Button */}
          <TouchableOpacity
            style={[
              styles.bookButton,
              (loadingActivity || !activity) && styles.bookButtonDisabled
            ]}
            onPress={handleBook}
            activeOpacity={0.8}
            disabled={loadingActivity || !activity}
          >
            {loadingActivity ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Text style={styles.bookButtonText}>
                BOOK NOW
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Booking Modal - Unified System */}
      {activity && (
        <BookingModalUnified
          visible={bookingModalVisible}
          onClose={handleBookingModalClose}
          activity={activity}
        />
      )}
    </View>
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
  heroImage: {
    width: '100%',
    height: 200,
  },
  content: {
    padding: 22,
    paddingTop: 20,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 19,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 11.5,
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  description: {
    fontSize: 13,
    color: 'rgba(242, 233, 216, 0.65)',
    lineHeight: 20.8,
    marginTop: 14,
  },
  featuresContainer: {
    marginTop: 20,
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
  },
  featureText: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
  },
  bookButton: {
    marginTop: 22,
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 4,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    opacity: 0.5,
  },
  bookButtonText: {
    color: COLORS.background,
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
});
