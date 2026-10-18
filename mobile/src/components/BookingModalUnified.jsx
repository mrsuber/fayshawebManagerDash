/**
 * BookingModalUnified
 * Unified booking modal for ALL wellness activities (journeys + services)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../constants/theme';
import wellnessUnifiedService from '../services/wellnessUnifiedService';

export default function BookingModalUnified({ visible, onClose, activity, isReschedule = false }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [availabilityData, setAvailabilityData] = useState([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  // Fetch availability when modal opens or activity changes
  useEffect(() => {
    if (visible && activity) {
      fetchAvailability();
    }
  }, [visible, activity]);

  const fetchAvailability = async () => {
    if (!activity || !activity.id) return;

    try {
      setIsLoadingAvailability(true);
      console.log('📡 [UNIFIED] Fetching availability for activity:', activity.id);

      const availability = await wellnessUnifiedService.getAvailability(
        activity.id,
        null, // Start from today
        7     // Next 7 days
      );

      console.log('📅 [UNIFIED] Fetched availability:', availability.length, 'slots');
      setAvailabilityData(availability || []);
    } catch (error) {
      console.error('❌ [UNIFIED] Error fetching availability:', error);
      Alert.alert('Error', 'Failed to load availability. Please try again.');
      setAvailabilityData([]);
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  // Reset state when modal closes
  const handleClose = (success = false) => {
    setSelectedDate(null);
    setSelectedTime(null);
    setIsBooking(false);
    setShowSuccessModal(false);
    setBookingDetails(null);
    setAvailabilityData([]);
    onClose(success);
  };

  // Generate available dates (today + next 6 days = 7 days total)
  const availableDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    // Format date as YYYY-MM-DD in local timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    availableDates.push({
      id: i + 1,
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      fullDate: date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }),
      dateObject: date,
      dateString: dateString,
    });
  }

  // Get time slots for selected date from availability data
  const getTimeSlotsForDate = (date) => {
    if (!date || !availabilityData.length) return [];

    // Filter slots for the selected date
    const slotsForDate = availabilityData.filter(slot => {
      return slot.date === date.dateString;
    });

    // Transform to UI format
    return slotsForDate.map((slot, index) => ({
      id: `${slot.date}-${slot.start_time}-${index}`,
      time: slot.label,
      value: slot.start_time,
      available: slot.is_available,
      conflictingBooking: slot.conflicting_booking,
    }));
  };

  const availableTimeSlots = selectedDate ? getTimeSlotsForDate(selectedDate) : [];

  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedTime || !activity) {
      Alert.alert('Error', 'Please select both date and time');
      return;
    }

    setIsBooking(true);
    try {
      console.log('📤 [UNIFIED] Booking activity:', {
        activity_id: activity.id,
        activity_name: activity.name,
        booking_date: selectedDate.dateString,
        start_time: selectedTime.value,
      });

      const response = await wellnessUnifiedService.bookActivity({
        activity_id: activity.id,
        booking_date: selectedDate.dateString,
        start_time: selectedTime.value,
        special_requests: '',
      });

      console.log('📥 [UNIFIED] Booking response:', response);

      if (response.success) {
        // Close the modal and notify parent of success
        // Use handleClose to properly reset all state
        handleClose(true);
      } else {
        throw new Error(response.error || 'Booking failed');
      }
    } catch (error) {
      console.error('Booking error:', error);
      const errorMessage = error.error || error.message || 'Unable to create booking';
      Alert.alert('Booking Failed', errorMessage);
      setIsBooking(false);
    }
  };

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => handleClose(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>
                {isReschedule ? 'Reschedule Activity' : 'Book Activity'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {activity?.name || 'Wellness Activity'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => handleClose(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Activity Info */}
            <View style={styles.activityCard}>
              <View style={styles.activityIconBox}>
                <Text style={styles.activityIcon}>{activity?.icon || '✨'}</Text>
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityLabel}>Duration</Text>
                <Text style={styles.activityValue}>
                  {activity?.duration || 60} minutes
                </Text>
                {activity?.type === 'journey' && activity.total_stages && (
                  <Text style={styles.activityStages}>
                    {activity.total_stages} stages
                  </Text>
                )}
              </View>
            </View>

            {/* Access Info */}
            {activity && (
              <View style={styles.accessInfoBox}>
                <Text style={styles.accessInfoIcon}>
                  {activity.type === 'journey' ? '🔑' : '🔓'}
                </Text>
                <Text style={styles.accessInfoText}>
                  {activity.type === 'journey'
                    ? 'A journey PIN will be sent to your Digital Key for accessing each stage.'
                    : 'Use your apartment door PIN to access this facility.'}
                </Text>
              </View>
            )}

            {/* Select Date */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SELECT DATE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled={true}
                contentContainerStyle={styles.datesScroll}
              >
                {availableDates.map((dateOption) => (
                  <TouchableOpacity
                    key={dateOption.id}
                    style={[
                      styles.dateCard,
                      selectedDate?.id === dateOption.id && styles.dateCardSelected,
                    ]}
                    onPress={() => setSelectedDate(dateOption)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.dateDay,
                        selectedDate?.id === dateOption.id && styles.dateDaySelected,
                      ]}
                    >
                      {dateOption.day}
                    </Text>
                    <Text
                      style={[
                        styles.dateNumber,
                        selectedDate?.id === dateOption.id && styles.dateNumberSelected,
                      ]}
                    >
                      {dateOption.date}
                    </Text>
                    <Text
                      style={[
                        styles.dateMonth,
                        selectedDate?.id === dateOption.id && styles.dateMonthSelected,
                      ]}
                    >
                      {dateOption.month}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Select Time */}
            {selectedDate && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SELECT TIME</Text>
                {isLoadingAvailability ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#7fae8a" />
                    <Text style={styles.loadingText}>Loading availability...</Text>
                  </View>
                ) : availableTimeSlots.length === 0 ? (
                  <View style={styles.noSlotsContainer}>
                    <Text style={styles.noSlotsText}>No available time slots for this date</Text>
                  </View>
                ) : (
                  <View style={styles.timeGrid}>
                    {availableTimeSlots.map((slot) => (
                      <TouchableOpacity
                        key={slot.id}
                        style={[
                          styles.timeSlot,
                          !slot.available && styles.timeSlotDisabled,
                          selectedTime?.id === slot.id && styles.timeSlotSelected,
                        ]}
                        onPress={() => slot.available && setSelectedTime(slot)}
                        activeOpacity={0.8}
                        disabled={!slot.available}
                      >
                        <Text
                          style={[
                            styles.timeSlotText,
                            !slot.available && styles.timeSlotTextDisabled,
                            selectedTime?.id === slot.id && styles.timeSlotTextSelected,
                          ]}
                        >
                          {slot.time}
                        </Text>
                        {!slot.available && slot.conflictingBooking && (
                          <Text style={styles.bookedText}>
                            {slot.conflictingBooking}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Summary */}
            {selectedDate && selectedTime && (
              <View style={styles.summaryCard}>
                <LinearGradient
                  colors={['rgba(127, 174, 138, 0.15)', 'rgba(74, 124, 89, 0.1)']}
                  style={styles.summaryGradient}
                >
                  <Text style={styles.summaryTitle}>Booking Summary</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Activity:</Text>
                    <Text style={styles.summaryValue}>{activity?.name}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Date:</Text>
                    <Text style={styles.summaryValue}>{selectedDate.fullDate}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Time:</Text>
                    <Text style={styles.summaryValue}>{selectedTime.time}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Duration:</Text>
                    <Text style={styles.summaryValue}>{activity?.duration} min</Text>
                  </View>
                </LinearGradient>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!selectedDate || !selectedTime || isBooking) && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirmBooking}
              activeOpacity={0.85}
              disabled={!selectedDate || !selectedTime || isBooking}
            >
              <LinearGradient
                colors={
                  selectedDate && selectedTime && !isBooking
                    ? ['#7fae8a', '#4a7c59']
                    : ['rgba(127, 174, 138, 0.3)', 'rgba(74, 124, 89, 0.3)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmButtonGradient}
              >
                {isBooking ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={COLORS.background} />
                    <Text style={[styles.confirmButtonText, { marginLeft: 8 }]}>
                      {isReschedule ? 'RESCHEDULING...' : 'BOOKING...'}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.confirmButtonText,
                      (!selectedDate || !selectedTime) && styles.confirmButtonTextDisabled,
                    ]}
                  >
                    {isReschedule ? 'CONFIRM RESCHEDULE' : 'CONFIRM BOOKING'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    color: COLORS.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7fae8a',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(242, 233, 216, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 12,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(127, 174, 138, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  activityIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(127, 174, 138, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIcon: {
    fontSize: 28,
  },
  activityInfo: {
    flex: 1,
  },
  activityLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginBottom: 2,
  },
  activityValue: {
    fontSize: 16,
    color: '#7fae8a',
    fontWeight: '700',
  },
  activityStages: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  accessInfoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(200, 164, 93, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    gap: 10,
    alignItems: 'center',
  },
  accessInfoIcon: {
    fontSize: 20,
  },
  accessInfoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.textTertiary,
    marginBottom: 14,
  },
  datesScroll: {
    gap: 12,
    paddingRight: 24,
  },
  dateCard: {
    width: 72,
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  dateCardSelected: {
    backgroundColor: 'rgba(127, 174, 138, 0.2)',
    borderColor: '#7fae8a',
    borderWidth: 2,
  },
  dateDay: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  dateDaySelected: {
    color: '#7fae8a',
  },
  dateNumber: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '700',
  },
  dateNumberSelected: {
    color: '#7fae8a',
  },
  dateMonth: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  dateMonthSelected: {
    color: '#7fae8a',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timeSlot: {
    width: '47%',
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: 'rgba(127, 174, 138, 0.2)',
    borderColor: '#7fae8a',
    borderWidth: 2,
  },
  timeSlotDisabled: {
    opacity: 0.4,
  },
  timeSlotText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
  },
  timeSlotTextSelected: {
    color: '#7fae8a',
  },
  timeSlotTextDisabled: {
    color: COLORS.textTertiary,
  },
  bookedText: {
    fontSize: 9,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  noSlotsContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127, 174, 138, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.2)',
  },
  noSlotsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  summaryCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  summaryGradient: {
    padding: 18,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7fae8a',
    marginBottom: 14,
    letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  summaryValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  confirmButton: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#7fae8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 13,
    letterSpacing: 2,
    color: COLORS.background,
    fontWeight: '700',
  },
  confirmButtonTextDisabled: {
    color: 'rgba(242, 233, 216, 0.4)',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalContainer: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.25)',
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7fae8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  successCheckmark: {
    fontSize: 52,
    color: COLORS.background,
    fontWeight: '700',
  },
  successTitle: {
    fontFamily: FONTS.heading,
    fontSize: 26,
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  successMessage: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  successInfoBox: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(127, 174, 138, 0.3)',
    alignItems: 'center',
    backgroundColor: 'rgba(127, 174, 138, 0.15)',
    width: '100%',
    gap: 12,
  },
  successInfoIcon: {
    fontSize: 26,
  },
  successInfoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
    fontWeight: '500',
  },
  successButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#7fae8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  successButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  successButtonText: {
    fontFamily: FONTS.heading,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.background,
    letterSpacing: 0.8,
  },
});
