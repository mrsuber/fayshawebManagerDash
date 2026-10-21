import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../site/api';

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');


  useEffect(() => {
    fetchData();
  }, [filterStatus, filterDateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch statistics
      const statsRes = await axios.get(`${API_URL}/bookings/stats/overview`);
      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }

      // Fetch bookings with filters
      let bookingsUrl = `${API_URL}/bookings`;
      const params = new URLSearchParams();

      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      if (filterDateRange !== 'all') {
        const today = new Date();
        let startDate;

        switch (filterDateRange) {
          case 'today':
            startDate = today.toISOString().split('T')[0];
            params.append('check_in_date', startDate);
            break;
          case 'week':
            startDate = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
            params.append('start_date', startDate);
            break;
          case 'month':
            startDate = new Date(today.setMonth(today.getMonth() - 1)).toISOString().split('T')[0];
            params.append('start_date', startDate);
            break;
        }
      }

      if (params.toString()) {
        bookingsUrl += '?' + params.toString();
      }

      const bookingsRes = await axios.get(bookingsUrl);
      if (bookingsRes.data.success) {
        setBookings(bookingsRes.data.bookings);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load bookings data');
    } finally {
      setLoading(false);
    }
  };

  const openDetailModal = async (booking) => {
    try {
      const response = await axios.get(`${API_URL}/bookings/${booking.id}`);
      if (response.data.success) {
        setSelectedBooking(response.data.booking);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error loading booking details:', error);
      alert('Failed to load booking details');
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedBooking(null);
  };

  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      // Confirming records the payment as received and sends the guest their digital key.
      if (newStatus === 'confirmed') await axios.post(`${API_URL}/bookings/${bookingId}/confirm`, {});
      else await axios.put(`${API_URL}/bookings/${bookingId}/status`, { status: newStatus });
      alert('Booking status updated successfully');
      fetchData();
      if (selectedBooking && selectedBooking.id === bookingId) {
        openDetailModal({ id: bookingId }); // Refresh detail view
      }
    } catch (error) {
      console.error('Error updating booking status:', error);
      alert('Failed to update booking status: ' + (error.response?.data?.message || error.message));
    }
  };

  const sendAccessCode = async (bookingId) => {
    try {
      await axios.post(`${API_URL}/bookings/${bookingId}/send-access-code`);
      alert('Access code sent successfully to guest email');
    } catch (error) {
      console.error('Error sending access code:', error);
      alert('Failed to send access code: ' + (error.response?.data?.message || error.message));
    }
  };

  const resendConfirmationEmail = async (bookingId) => {
    try {
      await axios.post(`${API_URL}/bookings/${bookingId}/resend-confirmation`);
      alert('Confirmation email sent successfully to guest');
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      alert('Failed to send confirmation email: ' + (error.response?.data?.message || error.message));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'checked_in': return 'bg-blue-100 text-blue-800';
      case 'checked_out': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateNights = (checkIn, checkOut) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filter bookings by search query
  const filteredBookings = bookings.filter(booking => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      booking.booking_number?.toLowerCase().includes(query) ||
      booking.guest_name?.toLowerCase().includes(query) ||
      booking.guest_email?.toLowerCase().includes(query) ||
      booking.unit_number?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Bookings Management</h1>
          <p className="text-gray-600 mt-1">Manage reservations and guest check-ins</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_bookings || 0}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Bookings</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{stats.confirmed || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Currently Checked-In</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{stats.checked_in || 0}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-primary-600 mt-2">
                    {parseInt(stats.total_revenue || 0).toLocaleString()} XAF
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Booking #, guest name, email..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <select
                value={filterDateRange}
                onChange={(e) => setFilterDateRange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-lg text-gray-900">{filteredBookings.length}</span> booking(s) found
              </div>
            </div>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Booking Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Apartment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetailModal(booking)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{booking.booking_number}</div>
                        <div className="text-sm text-gray-500">{formatDateTime(booking.created_at)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{booking.guest_name}</div>
                        <div className="text-sm text-gray-500">{booking.guest_email}</div>
                        <div className="text-sm text-gray-500">{booking.guest_phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Unit {booking.unit_number}</div>
                        <div className="text-sm text-gray-500">{booking.category_display_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">
                          {formatDate(booking.check_in_date)} →
                        </div>
                        <div className="text-sm text-gray-900">
                          {formatDate(booking.check_out_date)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {calculateNights(booking.check_in_date, booking.check_out_date)} night(s)
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {parseInt(booking.final_price).toLocaleString()} XAF
                      </div>
                      <div className="text-xs text-gray-500">
                        {booking.number_of_guests} guest(s)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetailModal(booking);
                        }}
                        className="text-primary-600 hover:text-primary-900 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBookings.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No bookings found</p>
            </div>
          )}
        </div>
      </div>

      {/* Booking Detail Modal */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Booking Details</h2>
                  <p className="text-gray-600">{selectedBooking.booking_number}</p>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Booking Info */}
                <div className="space-y-6">
                  {/* Status Section */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Booking Status</h3>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(selectedBooking.status)}`}>
                        {selectedBooking.status}
                      </span>
                    </div>

                    {/* Status Actions */}
                    <div className="space-y-2">
                      {selectedBooking.status === 'pending' && (
                        <button
                          onClick={() => updateBookingStatus(selectedBooking.id, 'confirmed')}
                          className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium"
                        >
                          Confirm Booking
                        </button>
                      )}
                      {selectedBooking.status === 'confirmed' && (
                        <button
                          onClick={() => updateBookingStatus(selectedBooking.id, 'checked_in')}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium"
                        >
                          Check In Guest
                        </button>
                      )}
                      {selectedBooking.status === 'checked_in' && (
                        <button
                          onClick={() => updateBookingStatus(selectedBooking.id, 'checked_out')}
                          className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium"
                        >
                          Check Out Guest
                        </button>
                      )}
                      {['pending', 'confirmed'].includes(selectedBooking.status) && (
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel this booking?')) {
                              updateBookingStatus(selectedBooking.id, 'cancelled');
                            }
                          }}
                          className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium"
                        >
                          Cancel Booking
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Guest Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Guest Information</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Name:</span>
                        <span className="text-sm font-medium text-gray-900">{selectedBooking.guest_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Email:</span>
                        <span className="text-sm font-medium text-gray-900">{selectedBooking.guest_email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Phone:</span>
                        <span className="text-sm font-medium text-gray-900">{selectedBooking.guest_phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Guests:</span>
                        <span className="text-sm font-medium text-gray-900">{selectedBooking.number_of_guests}</span>
                      </div>
                    </div>
                  </div>

                  {/* Apartment Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Apartment Information</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Unit:</span>
                        <span className="text-sm font-medium text-gray-900">{selectedBooking.unit_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Category:</span>
                        <span className="text-sm font-medium text-gray-900">{selectedBooking.category_display_name}</span>
                      </div>
                      {selectedBooking.building && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Building:</span>
                          <span className="text-sm font-medium text-gray-900">{selectedBooking.building}</span>
                        </div>
                      )}
                      {selectedBooking.floor !== null && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Floor:</span>
                          <span className="text-sm font-medium text-gray-900">{selectedBooking.floor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Dates & Payment */}
                <div className="space-y-6">
                  {/* Access Code */}
                  {selectedBooking.access_code && (
                    <div className="bg-primary-50 rounded-lg p-4 border-2 border-primary-200">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Access Code</h3>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary-600 tracking-wider mb-3">
                          {selectedBooking.access_code}
                        </div>
                        <button
                          onClick={() => sendAccessCode(selectedBooking.id)}
                          className="bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-lg text-sm font-medium"
                        >
                          Send to Guest Email
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Digital Key PIN */}
                  {selectedBooking.digital_key_pin && (
                    <div className="bg-amber-50 rounded-lg p-4 border-2 border-amber-200">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">🔑 Door PIN</h3>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-amber-600 tracking-wider mb-2">
                          {selectedBooking.digital_key_pin}
                        </div>
                        <p className="text-xs text-gray-600">Valid for entire stay</p>
                      </div>
                    </div>
                  )}

                  {/* Digital Key QR Code */}
                  {selectedBooking.digital_key_qr_code && (
                    <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">🔓 Gate QR Code</h3>
                      <div className="bg-white rounded p-3 border border-blue-300">
                        <code className="text-xs font-mono text-gray-800 break-all block mb-2">
                          {selectedBooking.digital_key_qr_code}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedBooking.digital_key_qr_code);
                            alert('QR Code copied to clipboard!');
                          }}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded text-sm font-medium"
                        >
                          Copy QR Code
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">For main gate access</p>
                    </div>
                  )}

                  {/* Resend Confirmation Email */}
                  {selectedBooking.guest_email && (
                    <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">📧 Confirmation Email</h3>
                      <button
                        onClick={() => resendConfirmationEmail(selectedBooking.id)}
                        className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium"
                      >
                        Resend Confirmation to Guest
                      </button>
                      <p className="text-xs text-gray-600 mt-2 text-center">
                        Includes booking details, door PIN, and gate QR code
                      </p>
                    </div>
                  )}

                  {/* Mobile App Account Credentials */}
                  {selectedBooking.user_email && (
                    <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-700">Mobile App Credentials</h3>
                        {selectedBooking.is_new_account && (
                          <span className="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Email:</label>
                          <div className="flex items-center bg-white rounded px-3 py-2 border border-green-200">
                            <code className="text-sm font-mono text-gray-900 flex-1">
                              {selectedBooking.user_email}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(selectedBooking.user_email);
                                alert('Email copied to clipboard!');
                              }}
                              className="ml-2 text-green-600 hover:text-green-800"
                              title="Copy to clipboard"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Username:</label>
                          <div className="flex items-center bg-white rounded px-3 py-2 border border-green-200">
                            <code className="text-sm font-mono text-gray-900 flex-1">
                              {selectedBooking.username}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(selectedBooking.username);
                                alert('Username copied to clipboard!');
                              }}
                              className="ml-2 text-green-600 hover:text-green-800"
                              title="Copy to clipboard"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Temporary Password:</label>
                          {selectedBooking.temporary_password ? (
                            <>
                              <div className="flex items-center bg-white rounded px-3 py-2 border border-green-200">
                                <code className="text-sm font-mono text-gray-900 flex-1 select-all">
                                  {selectedBooking.temporary_password}
                                </code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedBooking.temporary_password);
                                    alert('Password copied to clipboard!');
                                  }}
                                  className="ml-2 text-green-600 hover:text-green-800"
                                  title="Copy to clipboard"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">Guest will be prompted to change password on first login</p>
                            </>
                          ) : (
                            <div className="bg-yellow-50 rounded px-3 py-2 border border-yellow-200">
                              <p className="text-xs text-yellow-800">
                                Password was displayed only once when booking was created.
                                {selectedBooking.is_password_temporary && ' Guest has not changed their temporary password yet.'}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="pt-3 border-t border-green-200 space-y-2">
                          <p className="text-xs text-gray-600 flex items-center">
                            <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Download Fayshaa Wellness App:
                          </p>
                          <div className="flex gap-2">
                            <a
                              href={process.env.REACT_APP_IOS_APP_URL || 'https://apps.apple.com/app/fayshaa'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-gray-800 hover:bg-gray-900 text-white text-xs py-2 px-3 rounded text-center"
                            >
                              iOS App Store
                            </a>
                            <a
                              href={process.env.REACT_APP_ANDROID_APP_URL || 'https://play.google.com/store/apps/details?id=com.fayshaa'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-2 px-3 rounded text-center"
                            >
                              Google Play
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Stay Details</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Check-in:</span>
                        <span className="text-sm font-medium text-gray-900">{formatDate(selectedBooking.check_in_date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Check-out:</span>
                        <span className="text-sm font-medium text-gray-900">{formatDate(selectedBooking.check_out_date)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Nights:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {calculateNights(selectedBooking.check_in_date, selectedBooking.check_out_date)}
                        </span>
                      </div>
                      {selectedBooking.checked_in_at && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Checked in:</span>
                          <span className="text-sm font-medium text-gray-900">{formatDateTime(selectedBooking.checked_in_at)}</span>
                        </div>
                      )}
                      {selectedBooking.checked_out_at && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Checked out:</span>
                          <span className="text-sm font-medium text-gray-900">{formatDateTime(selectedBooking.checked_out_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Information</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Base Price:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {parseInt(selectedBooking.base_price || 0).toLocaleString()} XAF
                        </span>
                      </div>
                      {selectedBooking.discount_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Discount:</span>
                          <span className="text-sm font-medium text-green-600">
                            -{parseInt(selectedBooking.discount_amount).toLocaleString()} XAF
                          </span>
                        </div>
                      )}
                      {selectedBooking.tax_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Tax:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {parseInt(selectedBooking.tax_amount).toLocaleString()} XAF
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-900">Total:</span>
                        <span className="text-lg font-bold text-primary-600">
                          {parseInt(selectedBooking.final_price).toLocaleString()} XAF
                        </span>
                      </div>
                    </div>

                    {/* Payment Status */}
                    {selectedBooking.payment_status && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Payment Status:</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(selectedBooking.payment_status)}`}>
                            {selectedBooking.payment_status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Special Requests */}
                  {selectedBooking.special_requests && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Special Requests</h3>
                      <p className="text-sm text-gray-900">{selectedBooking.special_requests}</p>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Timestamps</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Created:</span>
                        <span className="text-xs text-gray-900">{formatDateTime(selectedBooking.created_at)}</span>
                      </div>
                      {selectedBooking.confirmed_at && (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-600">Confirmed:</span>
                          <span className="text-xs text-gray-900">{formatDateTime(selectedBooking.confirmed_at)}</span>
                        </div>
                      )}
                      {selectedBooking.cancelled_at && (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-600">Cancelled:</span>
                          <span className="text-xs text-gray-900">{formatDateTime(selectedBooking.cancelled_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={closeDetailModal}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings;
