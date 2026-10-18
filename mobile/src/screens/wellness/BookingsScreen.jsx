import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { fileUrl } from '../../config';
import { COLORS, FONTS } from '../../constants/theme';
import { WELLNESS_IMAGES } from '../../constants/images';
import WellnessSelectionModal from '../../components/WellnessSelectionModal';
import BookingModalUnified from '../../components/BookingModalUnified';
import PremiumModal from '../../components/PremiumModal';
import * as bookingService from '../../services/bookingService';
import wellnessUnifiedService from '../../services/wellnessUnifiedService';

export default function BookingsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('apartment');
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [apartmentBookingModalVisible, setApartmentBookingModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // New unified booking flow
  const [wellnessSelectionModalVisible, setWellnessSelectionModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [unifiedBookingModalVisible, setUnifiedBookingModalVisible] = useState(false);

  // Reschedule flow
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);

  // Data states
  const [apartmentBookings, setApartmentBookings] = useState([]);
  const [wellnessBookings, setWellnessBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const userId = user?.id;
  const [cancelling, setCancelling] = useState(null); // Track which booking is being cancelled

  // Fetch bookings when userId is available
  useEffect(() => {
    if (userId) {
      fetchBookings();
    }
  }, [userId]);

  const fetchBookings = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch both apartment and wellness bookings in parallel
      const [apartmentData, wellnessDataResponse] = await Promise.all([
        bookingService.getMyApartmentBookings(userId),
        wellnessUnifiedService.getMyBookings(), // UPDATED: Use unified service
      ]);

      // Extract bookings array from unified service response
      const wellnessData = wellnessDataResponse?.bookings || [];

      console.log('📊 Fetched apartment bookings:', apartmentData?.length || 0);
      console.log('📊 Fetched wellness bookings:', wellnessData?.length || 0);

      // Log apartment booking IDs to detect duplicates
      const apartmentIds = (apartmentData || []).map(b => b.id);
      console.log('🔍 Apartment booking IDs:', apartmentIds);
      const duplicateIds = apartmentIds.filter((id, index) => apartmentIds.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        console.warn('⚠️ Duplicate apartment booking IDs detected:', duplicateIds);
      }

      // Transform apartment bookings to match UI format
      const transformedApartments = (apartmentData || []).map(booking => {
        const dates = bookingService.formatBookingDates(
          booking.check_in_date,
          booking.check_out_date
        );

        // Map booking status to display status
        let displayStatus = 'upcoming';
        if (booking.status === 'checked_in') {
          displayStatus = 'active';
        } else if (booking.status === 'completed' || booking.status === 'checked_out') {
          displayStatus = 'completed';
        } else if (booking.status === 'cancelled') {
          displayStatus = 'cancelled';
        } else if (dates.status === 'active') {
          displayStatus = 'active';
        }

        return {
          id: booking.id,
          type: 'apartment',
          villaNumber: `RESIDENCE ${booking.unit_number || booking.apartment_id}`,
          villaName: booking.apartment_name || 'Residence',
          status: displayStatus,
          checkIn: dates.checkIn,
          checkOut: dates.checkOut,
          checkInTime: '2:00 PM',
          checkOutTime: '11:00 AM', // Default time
          nights: dates.nights,
          guests: booking.total_guests || 2,
          image: booking.image ? { uri: fileUrl(booking.image) } : WELLNESS_IMAGES.spa,
          bookingNumber: booking.booking_number,
        };
      });

      // Transform wellness bookings to match UI format
      const transformedWellness = (wellnessData || []).map(booking => {
        const bookingDate = new Date(booking.booking_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        let dateDisplay = '';
        if (bookingDate.toDateString() === today.toDateString()) {
          dateDisplay = 'Today';
        } else if (bookingDate.toDateString() === tomorrow.toDateString()) {
          dateDisplay = 'Tomorrow';
        } else {
          dateDisplay = bookingDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
        }

        // Format time (HH:MM:SS -> H:MM AM/PM)
        const timeStr = booking.start_time || '00:00:00';
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        const timeDisplay = `${displayHour}:${minutes} ${ampm}`;

        // Calculate duration
        const startTime = new Date(`2000-01-01T${booking.start_time}`);
        const endTime = new Date(`2000-01-01T${booking.end_time}`);
        const durationMinutes = (endTime - startTime) / (1000 * 60);
        const durationDisplay = durationMinutes >= 60
          ? `${Math.floor(durationMinutes / 60)} hour${Math.floor(durationMinutes / 60) > 1 ? 's' : ''}`
          : `${durationMinutes} min`;

        // Map category to proper case
        const categoryMap = {
          restore: 'Restore',
          recharge: 'Recharge',
          reflect: 'Reflect',
          explore: 'Explore',
        };

        // Get category image
        const categoryImageMap = {
          restore: WELLNESS_IMAGES.spa,
          recharge: WELLNESS_IMAGES.gym,
          reflect: WELLNESS_IMAGES.sunset,
          explore: WELLNESS_IMAGES.dining,
        };

        return {
          id: booking.id,
          type: 'wellness',
          name: booking.activity_name, // UPDATED: use activity_name from unified system
          category: categoryMap[booking.activity_category] || booking.activity_category, // UPDATED: use activity_category
          status: booking.status === 'confirmed' ? 'upcoming' : booking.status,
          date: dateDisplay,
          time: timeDisplay,
          duration: durationDisplay,
          location: 'Wellness Club', // Default location
          image: categoryImageMap[booking.activity_category] || WELLNESS_IMAGES.spa, // UPDATED: use activity_category
        };
      });

      // Deduplicate bookings by ID (in case API returns duplicates)
      const uniqueApartments = transformedApartments.filter((booking, index, self) =>
        index === self.findIndex(b => b.id === booking.id)
      );
      const uniqueWellness = transformedWellness.filter((booking, index, self) =>
        index === self.findIndex(b => b.id === booking.id)
      );

      console.log('✅ Unique apartment bookings:', uniqueApartments.length);
      console.log('✅ Unique wellness bookings:', uniqueWellness.length);

      setApartmentBookings(uniqueApartments);
      setWellnessBookings(uniqueWellness);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#7fae8a';
      case 'upcoming':
        return COLORS.primary;
      case 'completed':
        return COLORS.textTertiary;
      case 'cancelled':
        return '#E63946';
      default:
        return COLORS.textSecondary;
    }
  };

  const handleDigitalKey = (booking) => {
    navigation.navigate('DigitalKey');
  };

  const handleViewDetails = (booking) => {
    // Navigate to booking details
  };

  const handleNewBooking = () => {
    if (activeTab === 'apartment') {
      navigation.navigate('BookStay');
    } else {
      // Open wellness selection modal for unified booking
      setWellnessSelectionModalVisible(true);
    }
  };

  const handleActivitySelect = (activity) => {
    setSelectedActivity(activity);
    setUnifiedBookingModalVisible(true);
  };

  const handleUnifiedBookingClose = (success) => {
    setUnifiedBookingModalVisible(false);
    setSelectedActivity(null);

    if (success) {
      // Refresh bookings
      fetchBookings();
      setSuccessModalVisible(true);
    }
  };

  const handleBookingModalClose = (bookingConfirmed) => {
    setBookingModalVisible(false);

    if (bookingConfirmed) {
      setSuccessModalVisible(true);
      // Refresh bookings after successful booking
      fetchBookings();
    }
  };

  const handleCancelBooking = async (booking) => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel your ${booking.name} booking on ${booking.date} at ${booking.time}?`,
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(booking.id);
              await wellnessUnifiedService.cancelBooking(
                booking.id,
                'Cancelled by user via mobile app'
              );

              Alert.alert(
                'Booking Cancelled',
                'Your wellness booking has been cancelled successfully.',
                [{ text: 'OK' }]
              );

              // Refresh bookings
              await fetchBookings();
            } catch (error) {
              console.error('Cancel booking error:', error);
              Alert.alert(
                'Error',
                error.error || 'Failed to cancel booking. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setCancelling(null);
            }
          },
        },
      ]
    );
  };

  const handleRescheduleBooking = async (booking) => {
    try {
      // Fetch the full activity details for this booking
      const previousLoading = loading;
      if (!previousLoading) {
        setLoading(true);
      }

      // Get all activities and find the one matching this booking
      const categoryToSearch = booking.category ? booking.category.toLowerCase() : null;

      if (!categoryToSearch) {
        throw new Error('Booking category not available');
      }

      const response = await wellnessUnifiedService.getActivities({
        category: categoryToSearch
      });

      if (!response || !response.activities) {
        throw new Error('Failed to load activity details');
      }

      const activity = response.activities.find(
        a => a.name === booking.name || a.category === categoryToSearch
      );

      if (!activity) {
        throw new Error('Activity not found');
      }

      // Store the booking to be rescheduled
      setRescheduleBooking(booking);
      setSelectedActivity(activity);
      setRescheduleModalVisible(true);
    } catch (error) {
      console.error('Reschedule error:', error);
      Alert.alert(
        'Error',
        'Failed to load activity details for rescheduling. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleModalClose = async (success) => {
    setRescheduleModalVisible(false);
    setRescheduleBooking(null);
    setSelectedActivity(null);

    if (success) {
      // First, cancel the old booking
      try {
        await wellnessUnifiedService.cancelBooking(
          rescheduleBooking.id,
          'Rescheduled to a new time'
        );
      } catch (error) {
        console.error('Error cancelling old booking:', error);
      }

      // Refresh bookings
      await fetchBookings();

      Alert.alert(
        'Booking Rescheduled',
        'Your wellness booking has been rescheduled successfully.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderApartmentBooking = (booking) => (
    <View key={`apartment-${booking.id}`} style={styles.apartmentCard}>
      <ImageBackground
        source={booking.image}
        style={styles.apartmentImage}
        imageStyle={styles.apartmentImageStyle}
      >
        <LinearGradient
          colors={['rgba(13, 13, 13, 0.4)', 'rgba(13, 13, 13, 0.95)']}
          style={styles.apartmentGradient}
        >
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
            <Text style={styles.statusText}>
              {booking.status.toUpperCase()}
            </Text>
          </View>

          {/* Villa Info */}
          <View style={styles.apartmentInfo}>
            <Text style={styles.villaLabel}>{booking.villaNumber}</Text>
            <Text style={styles.villaName}>{booking.villaName}</Text>

            {/* Dates */}
            <View style={styles.datesContainer}>
              <View style={styles.dateBlock}>
                <Text style={styles.dateLabel}>CHECK-IN</Text>
                <Text style={styles.dateValue}>{booking.checkIn}</Text>
                <Text style={styles.timeValue}>{booking.checkInTime}</Text>
              </View>

              <View style={styles.dateArrow}>
                <Text style={styles.arrowText}>→</Text>
                <Text style={styles.nightsText}>{booking.nights} nights</Text>
              </View>

              <View style={styles.dateBlock}>
                <Text style={styles.dateLabel}>CHECK-OUT</Text>
                <Text style={styles.dateValue}>{booking.checkOut}</Text>
                <Text style={styles.timeValue}>{booking.checkOutTime}</Text>
              </View>
            </View>

            {/* Actions */}
            {booking.status === 'active' && (
              <TouchableOpacity
                style={styles.digitalKeyButton}
                onPress={() => handleDigitalKey(booking)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[COLORS.primary, '#D68910']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.digitalKeyGradient}
                >
                  <Text style={styles.digitalKeyIcon}>🔑</Text>
                  <Text style={styles.digitalKeyText}>DIGITAL KEY</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {booking.status === 'upcoming' && (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                  <Text style={styles.actionButtonText}>Modify</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                    View Details
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );

  const renderWellnessBooking = (booking) => (
    <TouchableOpacity
      key={`wellness-${booking.id}`}
      style={styles.wellnessCard}
      onPress={() => handleViewDetails(booking)}
      activeOpacity={0.85}
    >
      <ImageBackground
        source={booking.image}
        style={styles.wellnessImage}
        imageStyle={styles.wellnessImageStyle}
      >
        <LinearGradient
          colors={['rgba(13, 13, 13, 0.3)', 'rgba(13, 13, 13, 0.85)']}
          style={styles.wellnessGradient}
        >
          <View
            style={[
              styles.wellnessStatusBadge,
              { backgroundColor: getStatusColor(booking.status) },
            ]}
          >
            <Text style={styles.wellnessStatusText}>
              {booking.status.toUpperCase()}
            </Text>
          </View>
        </LinearGradient>
      </ImageBackground>

      <View style={styles.wellnessInfo}>
        <View style={styles.wellnessHeader}>
          <View style={styles.wellnessMain}>
            <Text style={styles.wellnessName}>{booking.name}</Text>
            <Text style={styles.wellnessCategory}>{booking.category}</Text>
          </View>
          <View style={styles.wellnessTime}>
            <Text style={styles.wellnessDate}>{booking.date}</Text>
            <Text style={styles.wellnessTimeValue}>{booking.time}</Text>
          </View>
        </View>

        <View style={styles.wellnessDetails}>
          <View style={styles.wellnessDetail}>
            <Text style={styles.detailIcon}>⏱</Text>
            <Text style={styles.detailText}>{booking.duration}</Text>
          </View>
          <View style={styles.wellnessDetail}>
            <Text style={styles.detailIcon}>📍</Text>
            <Text style={styles.detailText}>{booking.location}</Text>
          </View>
        </View>

        {booking.status === 'upcoming' && (
          <View style={styles.wellnessActions}>
            <TouchableOpacity
              style={styles.wellnessActionButton}
              activeOpacity={0.8}
              onPress={() => handleRescheduleBooking(booking)}
            >
              <Text style={styles.wellnessActionText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.wellnessActionButton,
                cancelling === booking.id && styles.wellnessActionButtonDisabled
              ]}
              activeOpacity={0.8}
              onPress={() => handleCancelBooking(booking)}
              disabled={cancelling === booking.id}
            >
              {cancelling === booking.id ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.wellnessActionText}>Cancel</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'apartment' && styles.tabActive]}
          onPress={() => setActiveTab('apartment')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'apartment' && styles.tabTextActive]}>
            APARTMENT STAYS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'wellness' && styles.tabActive]}
          onPress={() => setActiveTab('wellness')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'wellness' && styles.tabTextActive]}>
            WELLNESS BOOKINGS
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bookings List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading bookings...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchBookings}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'apartment' ? (
          <>
            {apartmentBookings.length > 0 ? (
              apartmentBookings.map(renderApartmentBooking)
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏠</Text>
                <Text style={styles.emptyText}>No apartment bookings</Text>
                <Text style={styles.emptySubtext}>
                  Tap + to book your stay
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {wellnessBookings.length > 0 ? (
              wellnessBookings.map(renderWellnessBooking)
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✦</Text>
                <Text style={styles.emptyText}>No wellness bookings</Text>
                <Text style={styles.emptySubtext}>
                  Explore activities in the Wellness tab
                </Text>
              </View>
            )}
          </>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Floating Action Button for New Booking */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleNewBooking}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#7fae8a', '#4a7c59']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Wellness Selection Modal - Choose Activity */}
      <WellnessSelectionModal
        visible={wellnessSelectionModalVisible}
        onClose={() => setWellnessSelectionModalVisible(false)}
        onSelectActivity={handleActivitySelect}
      />

      {/* Unified Booking Modal - Book Selected Activity */}
      <BookingModalUnified
        visible={unifiedBookingModalVisible}
        onClose={handleUnifiedBookingClose}
        activity={selectedActivity}
      />

      {/* Reschedule Booking Modal */}
      <BookingModalUnified
        visible={rescheduleModalVisible}
        onClose={handleRescheduleModalClose}
        activity={selectedActivity}
        isReschedule={true}
      />

      {/* Apartment Booking Info Modal */}
      <PremiumModal
        visible={apartmentBookingModalVisible}
        type="info"
        title="Book Apartment Stay"
        subtitle="Visit our website"
        message="Apartment bookings can be made on our website at fayshaa.com. We offer luxury apartments with all amenities."
        primaryButtonText="Got it"
        onClose={() => setApartmentBookingModalVisible(false)}
      />

      {/* Booking Success Modal */}
      <PremiumModal
        visible={successModalVisible}
        type="success"
        title="Booking Confirmed!"
        subtitle="Your wellness experience has been scheduled"
        message="Check your Digital Key for access details and booking information."
        primaryButtonText="View Digital Key"
        secondaryButtonText="OK"
        onPrimaryPress={() => {
          setSuccessModalVisible(false);
          navigation.navigate('DigitalKey');
        }}
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

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 22,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 16,
  },
  tab: {
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.primary,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 22,
    paddingBottom: 40,
  },

  // Apartment Booking Card
  apartmentCard: {
    height: 380,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  apartmentImage: {
    flex: 1,
  },
  apartmentImageStyle: {
    borderRadius: 16,
  },
  apartmentGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.background,
    fontWeight: '700',
  },
  apartmentInfo: {
    gap: 16,
  },
  villaLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(242, 233, 216, 0.7)',
  },
  villaName: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    color: COLORS.text,
  },
  datesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(13, 13, 13, 0.6)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
  },
  dateBlock: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 9,
    letterSpacing: 1,
    color: COLORS.textTertiary,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  dateArrow: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  arrowText: {
    fontSize: 18,
    color: COLORS.primary,
    marginBottom: 4,
  },
  nightsText: {
    fontSize: 9,
    color: COLORS.textTertiary,
  },
  digitalKeyButton: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  digitalKeyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  digitalKeyIcon: {
    fontSize: 18,
  },
  digitalKeyText: {
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.background,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(242, 233, 216, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: 'rgba(200, 164, 93, 0.2)',
    borderColor: COLORS.primary,
  },
  actionButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  actionButtonTextPrimary: {
    color: COLORS.primary,
  },

  // Wellness Booking Card
  wellnessCard: {
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  wellnessImage: {
    height: 100,
  },
  wellnessImageStyle: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  wellnessGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'flex-end',
  },
  wellnessStatusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  wellnessStatusText: {
    fontSize: 8,
    letterSpacing: 1,
    color: COLORS.background,
    fontWeight: '700',
  },
  wellnessInfo: {
    padding: 16,
  },
  wellnessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  wellnessMain: {
    flex: 1,
  },
  wellnessName: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  wellnessCategory: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  wellnessTime: {
    alignItems: 'flex-end',
  },
  wellnessDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  wellnessTimeValue: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  wellnessDetails: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  wellnessDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailIcon: {
    fontSize: 14,
  },
  detailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  wellnessActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  wellnessActionButton: {
    flex: 1,
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200, 164, 93, 0.3)',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  wellnessActionButtonDisabled: {
    opacity: 0.5,
  },
  wellnessActionText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Loading State
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 16,
  },

  // Error State
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    color: COLORS.background,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },

  bottomSpacing: {
    height: 20,
  },

  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 22,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#7fae8a',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 32,
    color: COLORS.background,
    fontWeight: '300',
  },
});
