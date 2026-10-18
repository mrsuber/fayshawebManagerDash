/**
 * Unified Wellness Service
 * Handles ALL wellness bookings: Journeys (multi-stage) and Services (single activities)
 *
 * Replaces wellnessJourneyService.js with unified approach
 */

import api from './api';

const wellnessUnifiedService = {
  /**
   * Get all wellness activities (journeys + services)
   * @param {Object} filters - { type: 'journey'|'service', category: 'restore'|'recharge'|'reflect'|'explore'|'fitness'|'spa'|'dining' }
   * @returns {Promise<Array>} List of activities
   */
  getActivities: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.category) params.append('category', filters.category);

      // Note: api.get already returns response.data via the interceptor
      const data = await api.get(`/wellness-unified/activities?${params.toString()}`);
      return data;
    } catch (error) {
      console.error('Get activities error:', error);
      throw error;
    }
  },

  /**
   * Get single activity with stages (if journey)
   * @param {number} activityId
   * @returns {Promise<Object>} Activity details with stages
   */
  getActivityById: async (activityId) => {
    try {
      // Note: api.get already returns response.data via the interceptor
      const data = await api.get(`/wellness-unified/activities/${activityId}`);
      return data;
    } catch (error) {
      console.error('Get activity by ID error:', error);
      throw error;
    }
  },

  /**
   * Get availability for an activity
   * @param {number} activityId - Activity ID
   * @param {string} date - Start date (YYYY-MM-DD), defaults to today
   * @param {number} days - Number of days to fetch (default 7)
   * @returns {Promise<Array>} Available time slots with conflict info
   */
  getAvailability: async (activityId, date = null, days = 7) => {
    try {
      const params = new URLSearchParams();
      params.append('days', days.toString());
      if (date) params.append('date', date);

      const data = await api.get(
        `/wellness-unified/activities/${activityId}/availability?${params.toString()}`
      );
      return data.availability || [];
    } catch (error) {
      console.error('Get availability error:', error);
      throw error;
    }
  },

  /**
   * Book a wellness activity (journey or service)
   * @param {Object} bookingData - { activity_id, booking_date, start_time, special_requests }
   * @returns {Promise<Object>} Booking confirmation
   */
  bookActivity: async (bookingData) => {
    try {
      // Note: api.post already returns response.data via the interceptor
      const data = await api.post('/wellness-unified/book', bookingData);
      return data;
    } catch (error) {
      console.error('Book activity error:', error);
      throw error;
    }
  },

  /**
   * Get user's wellness bookings
   * @returns {Promise<Array>} List of user's bookings
   */
  getMyBookings: async () => {
    try {
      // Note: api.get already returns response.data via the interceptor
      const data = await api.get('/wellness-unified/my-bookings');
      return data;
    } catch (error) {
      console.error('Get my bookings error:', error);
      throw error;
    }
  },

  /**
   * Cancel a booking
   * @param {number} bookingId
   * @param {string} cancellation_reason
   * @returns {Promise<Object>} Cancellation confirmation
   */
  cancelBooking: async (bookingId, cancellation_reason) => {
    try {
      // Note: api.patch already returns response.data via the interceptor
      const data = await api.patch(`/wellness-unified/bookings/${bookingId}/cancel`, {
        cancellation_reason
      });
      return data;
    } catch (error) {
      console.error('Cancel booking error:', error);
      throw error;
    }
  },

  /**
   * Get wellness journeys only
   * @returns {Promise<Array>} List of journey activities
   */
  getJourneys: async () => {
    try {
      // Note: api.get already returns response.data via the interceptor
      const data = await api.get('/wellness-unified/activities?type=journey');
      return data;
    } catch (error) {
      console.error('Get journeys error:', error);
      throw error;
    }
  },

  /**
   * Get wellness services only
   * @param {string} category - Optional: 'fitness', 'spa', 'dining'
   * @returns {Promise<Array>} List of service activities
   */
  getServices: async (category = null) => {
    try {
      const params = new URLSearchParams();
      params.append('type', 'service');
      if (category) params.append('category', category);

      // Note: api.get already returns response.data via the interceptor
      const data = await api.get(`/wellness-unified/activities?${params.toString()}`);
      return data;
    } catch (error) {
      console.error('Get services error:', error);
      throw error;
    }
  },

  /**
   * Get upcoming bookings only
   * @returns {Promise<Array>} List of upcoming bookings
   */
  getUpcomingBookings: async () => {
    try {
      // Note: api.get already returns response.data via the interceptor
      const data = await api.get('/wellness-unified/my-bookings');
      const allBookings = data.bookings || [];

      // Filter for upcoming bookings
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return allBookings.filter(booking => {
        const bookingDate = new Date(booking.booking_date);
        bookingDate.setHours(0, 0, 0, 0);

        return bookingDate >= today && booking.status === 'upcoming';
      });
    } catch (error) {
      console.error('Get upcoming bookings error:', error);
      throw error;
    }
  },

  /**
   * Get journey bookings with PINs (for Digital Key screen)
   * @returns {Promise<Array>} List of journey bookings with access codes
   */
  getJourneyBookingsWithPINs: async () => {
    try {
      // Note: api.get already returns response.data via the interceptor
      const data = await api.get('/wellness-unified/my-bookings');
      const allBookings = data.bookings || [];

      // Filter for journeys with PINs (upcoming or in-progress)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return allBookings.filter(booking => {
        const bookingDate = new Date(booking.booking_date);
        bookingDate.setHours(0, 0, 0, 0);

        return (
          booking.activity_type === 'journey' &&
          booking.activity_pin &&
          bookingDate >= today &&
          (booking.status === 'upcoming' || booking.status === 'in_progress')
        );
      });
    } catch (error) {
      console.error('Get journey bookings with PINs error:', error);
      throw error;
    }
  }
};

export default wellnessUnifiedService;
