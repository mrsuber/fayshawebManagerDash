import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  // The overview uses operational (staff-only) APIs; content roles start on Page Management.
  const isSuperadmin = user?.role === 'superadmin';
  const [stats, setStats] = useState({
    bookings: null,
    payments: null,
    apartments: null
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.REACT_APP_API_URL || (
    window.location.hostname !== 'localhost'
      ? '/api'
      : 'http://localhost:5001/api'
  );

  useEffect(() => {
    if (isSuperadmin) fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all statistics in parallel
      const [bookingStatsRes, paymentStatsRes, apartmentsRes, recentBookingsRes] = await Promise.all([
        axios.get(`${API_URL}/bookings/stats/overview`),
        axios.get(`${API_URL}/payments/stats/overview`),
        axios.get(`${API_URL}/apartments?limit=1000`),
        axios.get(`${API_URL}/bookings?limit=10`)
      ]);

      setStats({
        bookings: bookingStatsRes.data.success ? bookingStatsRes.data.stats : null,
        payments: paymentStatsRes.data.success ? paymentStatsRes.data.stats : null,
        apartments: apartmentsRes.data.success ? apartmentsRes.data.apartments : []
      });

      if (recentBookingsRes.data.success) {
        setRecentBookings(recentBookingsRes.data.bookings.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Don't show alert, just log the error
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'occupied': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'unavailable': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'checked_in': return 'bg-blue-100 text-blue-800';
      case 'checked_out': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculateOccupancyRate = () => {
    if (!stats.apartments || stats.apartments.length === 0) return 0;
    const occupied = stats.apartments.filter(apt => apt.status === 'occupied' || apt.status === 'maintenance').length;
    return Math.round((occupied / stats.apartments.length) * 100);
  };

  const getAvailableApartments = () => {
    if (!stats.apartments) return 0;
    return stats.apartments.filter(apt => apt.status === 'available').length;
  };

  if (user && !isSuperadmin) return <Navigate to="/admin/pages" replace />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here's what's happening with your property.</p>
        </div>

        {/* Key Metrics - Top Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-100 text-sm font-medium">Total Revenue</p>
                <p className="text-3xl font-bold mt-2">
                  {parseInt(stats.payments?.total_revenue || 0).toLocaleString()}
                </p>
                <p className="text-sm text-primary-100 mt-1">XAF</p>
              </div>
              <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-primary-400">
              <p className="text-sm text-primary-100">Today: {parseInt(stats.payments?.today_revenue || 0).toLocaleString()} XAF</p>
            </div>
          </div>

          {/* Total Bookings */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Bookings</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.bookings?.total_bookings || 0}</p>
              </div>
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-green-600 font-medium">
                {stats.bookings?.confirmed_bookings || 0} Active
              </span>
              <span className="text-gray-500">
                {stats.bookings?.pending_bookings || 0} Pending
              </span>
            </div>
          </div>

          {/* Checked In Guests */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Checked In</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.bookings?.checked_in_bookings || 0}</p>
              </div>
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Currently staying in property</p>
            </div>
          </div>

          {/* Occupancy Rate */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Occupancy Rate</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{calculateOccupancyRate()}%</p>
              </div>
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">{getAvailableApartments()} units available</p>
            </div>
          </div>
        </div>

        {/* Second Row - Payments & Apartments */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Payments</h3>
              <Link to="/admin/payments" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="text-sm font-semibold text-green-600">{stats.payments?.completed_payments || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="text-sm font-semibold text-yellow-600">{stats.payments?.pending_payments || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Failed</span>
                <span className="text-sm font-semibold text-red-600">{stats.payments?.failed_payments || 0}</span>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Refunds</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {parseInt(stats.payments?.total_refunds || 0).toLocaleString()} XAF
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Apartments</h3>
              <Link to="/admin/apartments" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Manage →
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-sm text-gray-600">Available</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{getAvailableApartments()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                  <span className="text-sm text-gray-600">Occupied</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {stats.apartments?.filter(apt => apt.status === 'occupied').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                  <span className="text-sm text-gray-600">Maintenance</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {stats.apartments?.filter(apt => apt.status === 'maintenance').length || 0}
                </span>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Total Units</span>
                  <span className="text-sm font-semibold text-primary-600">{stats.apartments?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              <Link
                to="/admin/bookings"
                className="block w-full bg-primary-50 hover:bg-primary-100 text-primary-700 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  View All Bookings
                </div>
              </Link>

              <Link
                to="/admin/apartments"
                className="block w-full bg-green-50 hover:bg-green-100 text-green-700 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Manage Apartments
                </div>
              </Link>

              <Link
                to="/admin/payments"
                className="block w-full bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  View Payments
                </div>
              </Link>

              <Link
                to="/admin/categories"
                className="block w-full bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Apartment Categories
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Bookings</h3>
              <Link to="/admin/bookings" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View All →
              </Link>
            </div>
          </div>

          {recentBookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Booking #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Guest
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Apartment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Check-in
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{booking.booking_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{booking.guest_name}</div>
                        <div className="text-sm text-gray-500">{booking.guest_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">Unit {booking.unit_number}</div>
                        <div className="text-sm text-gray-500">{booking.category_display_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(booking.check_in_date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {parseInt(booking.final_price).toLocaleString()} XAF
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-gray-500">No bookings yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
