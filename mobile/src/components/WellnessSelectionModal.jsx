/**
 * WellnessSelectionModal
 * Allows users to select which wellness activity to book (Journey or Service)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';
import wellnessUnifiedService from '../services/wellnessUnifiedService';

const CATEGORY_CONFIG = {
  journey: {
    title: 'Wellness Journeys',
    subtitle: 'Multi-stage guided experiences',
    icon: 'trail-sign-outline',
    color: '#7fae8a',
    gradient: ['rgba(127, 174, 138, 0.15)', 'rgba(74, 124, 89, 0.15)'],
  },
  fitness: {
    title: 'Fitness & Movement',
    subtitle: 'Gym, training, and classes',
    icon: 'fitness-outline',
    color: '#E87F5B',
    gradient: ['rgba(232, 127, 91, 0.15)', 'rgba(200, 100, 70, 0.15)'],
  },
  spa: {
    title: 'Spa & Wellness',
    subtitle: 'Massage, sauna, and treatments',
    icon: 'flower-outline',
    color: '#9B8DC0',
    gradient: ['rgba(155, 141, 192, 0.15)', 'rgba(120, 110, 160, 0.15)'],
  },
  dining: {
    title: 'Dining Experiences',
    subtitle: 'Restaurant and private chef',
    icon: 'restaurant-outline',
    color: '#D68910',
    gradient: ['rgba(214, 137, 16, 0.15)', 'rgba(180, 110, 10, 0.15)'],
  },
};

export default function WellnessSelectionModal({ visible, onClose, onSelectActivity }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    if (visible) {
      loadActivities();
    }
  }, [visible]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const response = await wellnessUnifiedService.getActivities();
      setActivities(response.activities || []);
    } catch (error) {
      console.error('Load activities error:', error);
      Alert.alert('Error', 'Failed to load wellness activities');
    } finally {
      setLoading(false);
    }
  };

  const groupedActivities = activities.reduce((acc, activity) => {
    // Group journeys by type 'journey'
    const category = activity.type === 'journey' ? 'journey' : activity.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(activity);
    return acc;
  }, {});

  const handleActivitySelect = (activity) => {
    onSelectActivity(activity);
    onClose();
  };

  const renderCategoryList = () => {
    return Object.keys(CATEGORY_CONFIG).map((categoryKey) => {
      const categoryActivities = groupedActivities[categoryKey] || [];
      if (categoryActivities.length === 0) return null;

      const config = CATEGORY_CONFIG[categoryKey];

      return (
        <View key={categoryKey} style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <View style={[styles.categoryIconBox, { backgroundColor: `${config.color}20` }]}>
              <Ionicons name={config.icon} size={24} color={config.color} />
            </View>
            <View style={styles.categoryTitleContainer}>
              <Text style={styles.categoryTitle}>{config.title}</Text>
              <Text style={styles.categorySubtitle}>{config.subtitle}</Text>
            </View>
          </View>

          <View style={styles.activitiesGrid}>
            {categoryActivities.map((activity) => (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityCard}
                onPress={() => handleActivitySelect(activity)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={config.gradient}
                  style={styles.activityGradient}
                >
                  <View style={styles.activityContent}>
                    <Text style={styles.activityIcon}>{activity.icon || '✨'}</Text>
                    <Text style={styles.activityName}>{activity.name}</Text>
                    <Text style={styles.activityDuration}>{activity.duration} min</Text>

                    {activity.type === 'journey' && (
                      <View style={styles.journeyBadge}>
                        <Text style={styles.journeyBadgeText}>
                          {activity.total_stages} stages
                        </Text>
                      </View>
                    )}

                    {activity.requires_staff && (
                      <View style={styles.staffBadge}>
                        <Ionicons name="person-outline" size={10} color={COLORS.textTertiary} />
                        <Text style={styles.staffBadgeText}>Staff required</Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.activityArrow, { backgroundColor: `${config.color}30` }]}>
                    <Ionicons name="arrow-forward" size={16} color={config.color} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Book Wellness Activity</Text>
            <Text style={styles.headerSubtitle}>Choose your experience</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : (
            <>
              {/* Info Banner */}
              <LinearGradient
                colors={['rgba(200, 164, 93, 0.1)', 'rgba(200, 164, 93, 0.05)']}
                style={styles.infoBanner}
              >
                <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
                <Text style={styles.infoBannerText}>
                  Wellness activities require an active apartment booking
                </Text>
              </LinearGradient>

              {/* Categories */}
              {renderCategoryList()}

              {activities.length === 0 && !loading && (
                <View style={styles.emptyContainer}>
                  <Ionicons name="leaf-outline" size={64} color={COLORS.textTertiary} />
                  <Text style={styles.emptyText}>No activities available</Text>
                  <Text style={styles.emptySubtext}>Please check back later</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200, 164, 93, 0.2)',
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 24,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.primary,
    lineHeight: 18,
  },

  // Category Section
  categorySection: {
    marginBottom: 28,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  categoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitleContainer: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  categorySubtitle: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
  },

  // Activities Grid
  activitiesGrid: {
    gap: 12,
  },
  activityCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.2)',
  },
  activityGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  activityName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  activityDuration: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginBottom: 8,
  },
  journeyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(127, 174, 138, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  journeyBadgeText: {
    fontSize: 10,
    color: '#7fae8a',
    fontWeight: '600',
  },
  staffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(200, 164, 93, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 6,
    gap: 4,
  },
  staffBadgeText: {
    fontSize: 9,
    color: COLORS.textTertiary,
    fontWeight: '500',
  },
  activityArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textTertiary,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 6,
  },
});
