import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../site/api';


const GuestManagement = () => {
  const { token, hasPermission } = useAuth();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [guestBookings, setGuestBookings] = useState([]);
  const [guestStats, setGuestStats] = useState(null);

  // Check permissions
  const canViewUsers = hasPermission('users', 'view');
  const canEditUsers = hasPermission('users', 'edit');

  // Fetch guests (users with role 'guest')
  const fetchGuests = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        role: 'guest',
        page: page.toString(),
        limit: '10'
      });

      if (statusFilter) queryParams.append('status', statusFilter);

      const response = await fetch(`${API_URL}/users?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        // Fetch additional data for each guest (booking count, etc.)
        const guestsWithStats = await Promise.all(
          data.users.map(async (guest) => {
            try {
              // Fetch guest's bookings
              const bookingsRes = await fetch(`${API_URL}/bookings?userId=${guest.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const bookingsData = await bookingsRes.json();

              const bookings = bookingsData.bookings || [];
              const totalBookings = bookings.length;
              const activeBookings = bookings.filter(b =>
                b.status === 'confirmed' || b.status === 'checked_in'
              ).length;
              const totalSpent = bookings.reduce((sum, b) =>
                sum + (parseFloat(b.total_amount) || 0), 0
              );

              return {
                ...guest,
                totalBookings,
                activeBookings,
                totalSpent
              };
            } catch (err) {
              console.error(`Failed to fetch stats for guest ${guest.id}:`, err);
              return {
                ...guest,
                totalBookings: 0,
                activeBookings: 0,
                totalSpent: 0
              };
            }
          })
        );

        setGuests(guestsWithStats);
        setTotalPages(data.pagination.totalPages);
      } else {
        setError(data.error || 'Failed to fetch guests');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Fetch guests error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch guest details
  const fetchGuestDetails = async (guestId) => {
    try {
      setLoading(true);

      // Fetch bookings
      const bookingsRes = await fetch(`${API_URL}/bookings?userId=${guestId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const bookingsData = await bookingsRes.json();

      if (bookingsData.success) {
        setGuestBookings(bookingsData.bookings || []);
      }

      // Calculate stats
      const bookings = bookingsData.bookings || [];
      const stats = {
        totalBookings: bookings.length,
        confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
        completedBookings: bookings.filter(b => b.status === 'checked_out').length,
        cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
        totalSpent: bookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0),
        totalPaid: bookings.reduce((sum, b) => sum + (parseFloat(b.amount_paid) || 0), 0)
      };

      setGuestStats(stats);
      setShowDetailsModal(true);
    } catch (err) {
      setError('Failed to fetch guest details');
      console.error('Fetch guest details error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Unlock guest account
  const unlockGuest = async (guestId) => {
    try {
      const response = await fetch(`${API_URL}/users/${guestId}/unlock`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Guest account unlocked successfully');
        fetchGuests();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to unlock guest account');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  // Deactivate guest account
  const deactivateGuest = async (guestId) => {
    if (!window.confirm('Are you sure you want to deactivate this guest account?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/${guestId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'inactive' })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Guest account deactivated successfully');
        fetchGuests();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to deactivate guest account');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  useEffect(() => {
    if (canViewUsers) {
      fetchGuests();
    }
  }, [page, statusFilter]);

  // Filter guests by search term
  const filteredGuests = guests.filter(guest => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      guest.email?.toLowerCase().includes(search) ||
      guest.full_name?.toLowerCase().includes(search) ||
      guest.username?.toLowerCase().includes(search)
    );
  });

  // Status badge color
  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Booking status badge
  const getBookingStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'checked_in':
        return 'bg-green-100 text-green-800';
      case 'checked_out':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!canViewUsers) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          You don't have permission to view guests.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-heading text-gray-900">Guest Management</h1>
        <p className="text-gray-600 mt-1">
          Manage guests who have booked apartments and use the mobile app
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Guests
            </label>
            <input
              type="text"
              placeholder="Email, name, or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Stats Summary */}
          <div className="flex items-end">
            <div className="bg-primary-50 rounded-lg p-3 w-full">
              <div className="text-sm text-gray-600">Total Guests</div>
              <div className="text-2xl font-bold text-primary-600">{filteredGuests.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Guests Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bookings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGuests.map((guest) => (
                <tr key={guest.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-semibold">
                          {guest.full_name?.charAt(0)?.toUpperCase() || guest.email?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {guest.full_name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          @{guest.username}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{guest.email}</div>
                    {!guest.email_verified && (
                      <span className="text-xs text-orange-600">⚠ Not verified</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <span className="font-semibold">{guest.totalBookings || 0}</span> total
                    </div>
                    {guest.activeBookings > 0 && (
                      <div className="text-xs text-green-600">
                        {guest.activeBookings} active
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      ${(guest.totalSpent || 0).toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(guest.status)}`}>
                        {guest.status}
                      </span>
                      {guest.is_locked && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          🔒 Locked
                        </span>
                      )}
                      {guest.failed_login_attempts > 0 && !guest.is_locked && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                          ⚠️ {guest.failed_login_attempts} failed login{guest.failed_login_attempts > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {guest.last_login ? new Date(guest.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedGuest(guest);
                        fetchGuestDetails(guest.id);
                      }}
                      className="text-primary-600 hover:text-primary-900 mr-3"
                    >
                      View Details
                    </button>
                    {canEditUsers && guest.is_locked && (
                      <button
                        onClick={() => unlockGuest(guest.id)}
                        className="text-purple-600 hover:text-purple-900 mr-3"
                        title="Unlock account"
                      >
                        🔓 Unlock
                      </button>
                    )}
                    {canEditUsers && guest.status === 'active' && (
                      <button
                        onClick={() => deactivateGuest(guest.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredGuests.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No guests found
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center space-x-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Guest Details Modal */}
      {showDetailsModal && selectedGuest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-heading text-gray-900">Guest Details</h2>
                  <p className="text-gray-600 mt-1">{selectedGuest.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedGuest(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Guest Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Guest Information</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <span className="text-sm text-gray-600">Full Name:</span>
                    <p className="font-medium">{selectedGuest.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Username:</span>
                    <p className="font-medium">@{selectedGuest.username}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Email:</span>
                    <p className="font-medium">{selectedGuest.email}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Joined:</span>
                    <p className="font-medium">
                      {new Date(selectedGuest.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              {guestStats && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Booking Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600">Total Bookings</div>
                      <div className="text-2xl font-bold text-blue-600">{guestStats.totalBookings}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600">Completed</div>
                      <div className="text-2xl font-bold text-green-600">{guestStats.completedBookings}</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600">Total Spent</div>
                      <div className="text-2xl font-bold text-purple-600">${guestStats.totalSpent.toFixed(2)}</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600">Total Paid</div>
                      <div className="text-2xl font-bold text-orange-600">${guestStats.totalPaid.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bookings List */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Booking History</h3>
                {guestBookings.length > 0 ? (
                  <div className="space-y-3">
                    {guestBookings.map((booking) => (
                      <div key={booking.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {booking.apartment_name || `Apartment #${booking.apartment_id}`}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {new Date(booking.check_in_date).toLocaleDateString()} - {new Date(booking.check_out_date).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getBookingStatusBadge(booking.status)}`}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                          <div>
                            <span className="text-gray-600">Guests:</span>
                            <span className="ml-2 font-medium">{booking.number_of_guests}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Total:</span>
                            <span className="ml-2 font-medium">${parseFloat(booking.total_amount || 0).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Paid:</span>
                            <span className="ml-2 font-medium">${parseFloat(booking.amount_paid || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No bookings found
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedGuest(null);
                }}
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestManagement;
