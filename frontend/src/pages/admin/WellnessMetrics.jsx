import { Link } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../site/api';

const WellnessMetrics = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState({
    totalActivities: 0,
    totalZones: 0,
    totalBookings: 0,
    activeBookings: 0,
    recentMessages: 0,
    topActivities: [],
    bookingsByStatus: {},
    bookingsByMood: {}
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch all data in parallel
      const [activitiesRes, zonesRes, bookingsRes, messagesRes] = await Promise.all([
        fetch(`${API_URL}/wellness/activities`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/wellness/zones`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/wellness/admin/bookings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/wellness/admin/concierge/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const activities = await activitiesRes.json();
      const zones = await zonesRes.json();
      const bookings = await bookingsRes.json();
      const messages = await messagesRes.json();

      // Calculate stats
      const bookingsByStatus = {};
      const bookingsByMood = {};
      const activityBookingCount = {};

      if (bookings.success && bookings.bookings) {
        bookings.bookings.forEach(booking => {
          // Status count
          bookingsByStatus[booking.status] = (bookingsByStatus[booking.status] || 0) + 1;

          // Activity count
          activityBookingCount[booking.activity_id] =
            (activityBookingCount[booking.activity_id] || 0) + 1;
        });
      }

      // Get top activities
      const topActivities = activities.success && activities.activities
        ? activities.activities
            .map(act => ({
              ...act,
              bookingCount: activityBookingCount[act.id] || 0
            }))
            .sort((a, b) => b.bookingCount - a.bookingCount)
            .slice(0, 5)
        : [];

      // Count bookings by category
      if (activities.success && activities.activities) {
        activities.activities.forEach(act => {
          const count = activityBookingCount[act.id] || 0;
          bookingsByMood[act.category] = (bookingsByMood[act.category] || 0) + count;
        });
      }

      // Get recent messages (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentMessages = messages.success && messages.messages
        ? messages.messages.filter(msg => new Date(msg.created_at) > oneDayAgo).length
        : 0;

      setStats({
        totalActivities: activities.success ? activities.activities.length : 0,
        totalZones: zones.success ? zones.zones.length : 0,
        totalBookings: bookings.success ? bookings.bookings.length : 0,
        activeBookings: bookingsByStatus.confirmed || 0,
        recentMessages,
        topActivities,
        bookingsByStatus,
        bookingsByMood
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const moodColors = {
    restore: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '🧘' },
    recharge: { bg: 'bg-green-100', text: 'text-green-800', icon: '⚡' },
    reflect: { bg: 'bg-purple-100', text: 'text-purple-800', icon: '🌅' },
    explore: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '🌍' },
    spa: { bg: 'bg-pink-100', text: 'text-pink-800', icon: '💆' },
    fitness: { bg: 'bg-green-100', text: 'text-green-800', icon: '💪' },
    dining: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '🍽️' },
    other: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '✨' }
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
        <h1 className="text-3xl font-heading text-gray-900">Wellness Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of wellness system statistics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="text-3xl font-bold text-gray-900">{stats.totalActivities}</div>
          <div className="text-sm text-gray-600 mt-1">Total Activities</div>
          <div className="text-xs text-blue-600 mt-2">Available for guests</div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="text-3xl font-bold text-gray-900">{stats.totalZones}</div>
          <div className="text-sm text-gray-600 mt-1">Wellness Zones</div>
          <div className="text-xs text-green-600 mt-2">Across the estate</div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
          <div className="text-3xl font-bold text-gray-900">{stats.totalBookings}</div>
          <div className="text-sm text-gray-600 mt-1">Total Bookings</div>
          <div className="text-xs text-purple-600 mt-2">All time</div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
          <div className="text-3xl font-bold text-gray-900">{stats.activeBookings}</div>
          <div className="text-sm text-gray-600 mt-1">Active Bookings</div>
          <div className="text-xs text-yellow-600 mt-2">Confirmed</div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
          <div className="text-3xl font-bold text-gray-900">{stats.recentMessages}</div>
          <div className="text-sm text-gray-600 mt-1">New Messages</div>
          <div className="text-xs text-red-600 mt-2">Last 24 hours</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Activities */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Top Activities</h2>
            <p className="text-sm text-primary-100 mt-1">Most booked wellness activities</p>
          </div>
          <div className="p-6">
            {stats.topActivities.length > 0 ? (
              <div className="space-y-4">
                {stats.topActivities.map((activity, idx) => (
                  <div key={activity.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl font-bold text-gray-300">#{idx + 1}</div>
                      <div>
                        <div className="font-medium text-gray-900">{activity.name}</div>
                        <div className={`text-xs px-2 py-1 rounded inline-flex items-center mt-1 ${
                          moodColors[activity.category]?.bg || 'bg-gray-100'
                        } ${
                          moodColors[activity.category]?.text || 'text-gray-800'
                        }`}>
                          {moodColors[activity.category]?.icon} {activity.category}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary-600">
                        {activity.bookingCount}
                      </div>
                      <div className="text-xs text-gray-500">bookings</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No bookings yet
              </div>
            )}
          </div>
        </div>

        {/* Bookings by Status */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Booking Status</h2>
            <p className="text-sm text-green-100 mt-1">Current booking distribution</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {Object.entries(stats.bookingsByStatus).map(([status, count]) => {
                const total = Object.values(stats.bookingsByStatus).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

                const statusColors = {
                  pending: 'bg-yellow-500',
                  confirmed: 'bg-green-500',
                  completed: 'bg-blue-500',
                  cancelled: 'bg-red-500'
                };

                return (
                  <div key={status}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 capitalize">{status}</span>
                      <span className="text-sm font-semibold text-gray-900">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${statusColors[status] || 'bg-gray-500'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {Object.keys(stats.bookingsByStatus).length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No bookings yet
              </div>
            )}
          </div>
        </div>

        {/* Bookings by Mood */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Mood Preferences</h2>
            <p className="text-sm text-purple-100 mt-1">Bookings by wellness category</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(stats.bookingsByMood).map(([mood, count]) => (
                <div
                  key={mood}
                  className={`p-4 rounded-lg border-2 ${
                    moodColors[mood]?.bg || 'bg-gray-100'
                  } border-gray-200`}
                >
                  <div className="text-2xl mb-2">{moodColors[mood]?.icon}</div>
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                  <div className="text-sm text-gray-600 capitalize mt-1">{mood}</div>
                </div>
              ))}
            </div>

            {Object.keys(stats.bookingsByMood).length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No bookings yet
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
            <p className="text-sm text-orange-100 mt-1">Manage your wellness system</p>
          </div>
          <div className="p-6 space-y-3">
            <Link
              to="/admin/wellness/activities"
              className="block w-full bg-blue-50 text-blue-700 px-4 py-3 rounded-lg hover:bg-blue-100 transition-colors font-medium text-center"
            >
              Manage Activities
            </Link>
            <Link
              to="/admin/wellness/zones"
              className="block w-full bg-green-50 text-green-700 px-4 py-3 rounded-lg hover:bg-green-100 transition-colors font-medium text-center"
            >
              Manage Zones
            </Link>
            <Link
              to="/admin/wellness/bookings"
              className="block w-full bg-purple-50 text-purple-700 px-4 py-3 rounded-lg hover:bg-purple-100 transition-colors font-medium text-center"
            >
              View Bookings
            </Link>
            <Link
              to="/admin/wellness/concierge"
              className="block w-full bg-orange-50 text-orange-700 px-4 py-3 rounded-lg hover:bg-orange-100 transition-colors font-medium text-center"
            >
              Concierge Messages
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WellnessMetrics;
