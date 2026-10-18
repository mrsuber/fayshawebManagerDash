import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../constants/theme';
import { MOOD_DATA } from '../../constants/wellnessData';

export default function MoodHubScreen({ route, navigation }) {
  const { moodKey } = route.params;
  const moodInfo = MOOD_DATA[moodKey];

  const handleActivityPress = (activity) => {
    navigation.navigate('Detail', {
      title: activity.name,
      subtitle: moodInfo.label,
      img: activity.img,
      description: activity.desc,
      features: activity.features,
    });
  };

  const handleBookSession = () => {
    navigation.navigate('Bookings');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Tagline */}
        <LinearGradient
          colors={['rgba(200, 164, 93, 0.1)', 'rgba(200, 164, 93, 0.03)']}
          style={styles.headerCard}
        >
          <Text style={styles.categoryLabel}>{moodInfo.label.toUpperCase()}</Text>
          <Text style={styles.tagline}>{moodInfo.tagline}</Text>
        </LinearGradient>

        {/* Activities List */}
        <View style={styles.activitiesSection}>
          <Text style={styles.sectionTitle}>AVAILABLE EXPERIENCES</Text>

          {moodInfo.activities.map((activity, index) => (
            <TouchableOpacity
              key={index}
              style={styles.activityCard}
              onPress={() => handleActivityPress(activity)}
              activeOpacity={0.85}
            >
              <ImageBackground
                source={activity.img}
                style={styles.activityImage}
                imageStyle={styles.activityImageStyle}
              >
                <LinearGradient
                  colors={['rgba(13, 13, 13, 0.3)', 'rgba(13, 13, 13, 0.85)']}
                  style={styles.activityGradient}
                />
              </ImageBackground>

              <View style={styles.activityInfo}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityName}>{activity.name}</Text>
                  <View style={styles.activityChevron}>
                    <Text style={styles.chevronText}>›</Text>
                  </View>
                </View>
                <Text style={styles.activityTime}>{activity.time}</Text>
                {activity.desc && (
                  <Text style={styles.activityDesc} numberOfLines={2}>
                    {activity.desc}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Book Session Button */}
        <TouchableOpacity
          onPress={handleBookSession}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#C8A45D', '#D68910']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bookButton}
          >
            <Text style={styles.bookButtonText}>BOOK A SESSION</Text>
            <View style={styles.bookButtonIcon}>
              <Text style={styles.bookButtonIconText}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 40,
  },

  // Header Card
  headerCard: {
    marginHorizontal: 22,
    marginTop: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
  },
  categoryLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  // Activities Section
  activitiesSection: {
    paddingHorizontal: 22,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.textTertiary,
    fontWeight: '700',
    marginBottom: 14,
  },

  // Activity Cards
  activityCard: {
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  activityImage: {
    height: 100,
  },
  activityImageStyle: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  activityGradient: {
    flex: 1,
  },
  activityInfo: {
    padding: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activityName: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
  },
  activityChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
  },
  chevronText: {
    fontSize: 18,
    color: COLORS.primary,
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 8,
    fontWeight: '600',
  },
  activityDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  // Book Button
  bookButton: {
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
  bookButtonText: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.background,
    fontWeight: '700',
  },
  bookButtonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonIconText: {
    fontSize: 14,
    color: COLORS.background,
    fontWeight: 'bold',
  },

  bottomSpacing: {
    height: 20,
  },
});
