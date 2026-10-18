/**
 * Booking Service
 * API calls for apartment bookings
 * Uses apiClient which automatically includes auth token
 */

import apiClient from './api';

/**
 * Get current user's apartment bookings
 * @param {string} userId - User ID
 * @param {string} status - Optional status filter (confirmed, checked_in, completed, cancelled)
 * @returns {Promise<Array>} List of apartment bookings
 */
export const getMyApartmentBookings = async () => {
  try {
    // The guest's own stays (GET /api/guest/stays), in the row shape the v1 screens expect.
    const stays = await apiClient.get('/guest/stays');
    return (stays || []).map((s) => ({
      id: s.id,
      booking_number: s.number,
      status: s.status,
      check_in_date: s.checkIn,
      check_out_date: s.checkOut,
      unit_number: s.residence.unit,
      apartment_name: s.residence.name,
      total_guests: s.guests,
      image: s.residence.image,
    }));
  } catch (error) {
    console.error('Get my apartment bookings error:', error);
    return [];
  }
};

/**
 * Get active digital keys for current user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Digital keys for apartments and wellness
 */
export const getMyDigitalKeys = async (userId) => {
  try {
    if (!userId) {
      console.warn('userId is required for getMyDigitalKeys');
      return { apartments: [], wellness: [] };
    }

    const response = await apiClient.get('/bookings/user/my-keys', {
      params: { user_id: userId }
    });

    return {
      apartments: response.apartments || [],
      wellness: response.wellness || []
    };
  } catch (error) {
    console.error('Get my digital keys error:', error);
    return { apartments: [], wellness: [] };
  }
};

/**
 * Get single booking details
 * @param {number} bookingId - Booking ID
 * @returns {Promise<Object>} Booking details
 */
export const getBookingDetail = async (bookingId) => {
  try {
    const response = await apiClient.get(`/bookings/${bookingId}`);
    return response.booking;
  } catch (error) {
    console.error('Get booking detail error:', error);
    throw error;
  }
};

/**
 * Helper: Format booking dates for display
 * @param {string} checkIn - Check-in date (YYYY-MM-DD)
 * @param {string} checkOut - Check-out date (YYYY-MM-DD)
 * @returns {Object} Formatted dates and status
 */
export const formatBookingDates = (checkIn, checkOut) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine booking status
  let status = 'upcoming';
  if (checkInDate <= today && checkOutDate > today) {
    status = 'active';
  } else if (checkOutDate <= today) {
    status = 'completed';
  }

  // Format dates
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  return {
    checkIn: formatDate(checkInDate),
    checkOut: formatDate(checkOutDate),
    status,
    nights: Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
  };
};

/**
 * Helper: Get status color for booking
 * @param {string} status - Booking status
 * @returns {string} Color hex code
 */
export const getBookingStatusColor = (status) => {
  const colors = {
    confirmed: '#3B82F6',
    checked_in: '#7fae8a',
    completed: '#4CAF50',
    cancelled: '#E63946',
    pending: '#FF8C42'
  };
  return colors[status] || '#6B7280';
};

export default {
  getMyApartmentBookings,
  getMyDigitalKeys,
  getBookingDetail,
  formatBookingDates,
  getBookingStatusColor,
};
