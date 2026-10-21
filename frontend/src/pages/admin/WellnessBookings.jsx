import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../site/api';

const WellnessBookings = () => {
  const { token } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  const statusColors = {
    upcoming: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', label: 'Upcoming' },
    in_progress: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', label: 'In progress' },
    completed: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', label: 'Completed' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', label: 'Cancelled' },
    no_show: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', label: 'No-show' }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch(`${API_URL}/wellness/admin/bookings?limit=200`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBookings(data.bookings);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/wellness/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();
      if (data.success) {
        fetchBookings();
      } else {
        alert(data.error || 'Could not update the booking');
      }
    } catch (error) {
      console.error('Error updating booking:', error);
    }
  };

  const filteredBookings = filterStatus === 'all'
    ? bookings
    : bookings.filter(b => b.status === filterStatus);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-heading text-gray-900">Wellness Bookings</h1>
        <p className="text-gray-600 mt-1">Manage all guest wellness activity bookings</p>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex space-x-2">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filterStatus === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Bookings
        </button>
        {Object.keys(statusColors).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
              filterStatus === status
                ? statusColors[status].bg + ' ' + statusColors[status].text
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {statusColors[status].label}
          </button>
        ))}
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
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
              {filteredBookings.map(booking => (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {booking.user_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {booking.user_email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{booking.activity_name}</div>
                    {booking.special_requests && (
                      <div className="text-sm text-gray-500 mt-1">
                        Note: {booking.special_requests}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(booking.booking_date)}
                    </div>
                    {booking.start_time && (
                      <div className="text-sm text-gray-500">
                        {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {booking.activity_type === 'journey' ? 'Journey' : 'Service'}{booking.room ? ` · ${booking.room}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      statusColors[booking.status]?.bg || 'bg-gray-100'
                    } ${
                      statusColors[booking.status]?.text || 'text-gray-800'
                    }`}>
                      {statusColors[booking.status]?.label || booking.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex space-x-2">
                      {booking.status === 'upcoming' && (
                        <>
                          <button onClick={() => updateBookingStatus(booking.id, 'in_progress')} className="text-green-600 hover:text-green-900 font-medium">
                            Start
                          </button>
                          <button onClick={() => updateBookingStatus(booking.id, 'no_show')} className="text-gray-600 hover:text-gray-900 font-medium">
                            No-show
                          </button>
                          <button
                            onClick={() => window.confirm('Cancel this booking? The guest is notified.') && updateBookingStatus(booking.id, 'cancelled')}
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {booking.status === 'in_progress' && (
                        <button onClick={() => updateBookingStatus(booking.id, 'completed')} className="text-blue-600 hover:text-blue-900 font-medium">
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBookings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {filterStatus === 'all'
                ? 'No bookings found'
                : `No ${statusColors[filterStatus].label.toLowerCase()} bookings`}
            </p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        {Object.entries(statusColors).map(([status, c]) => (
          <div key={status} className={`${c.bg} border ${c.border} rounded-lg p-6`}>
            <div className={`text-2xl font-bold ${c.text}`}>{bookings.filter(b => b.status === status).length}</div>
            <div className={`text-sm ${c.text} mt-1`}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WellnessBookings;
