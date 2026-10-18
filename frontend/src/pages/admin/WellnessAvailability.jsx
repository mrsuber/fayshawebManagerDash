import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const WellnessAvailability = () => {
  const { token } = useAuth();
  const [availability, setAvailability] = useState([]);
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [filterJourney, setFilterJourney] = useState('all');
  const [stats, setStats] = useState(null);
  const [formData, setFormData] = useState({
    journey_id: '',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '10:30',
    max_capacity: 3,
    days_of_week: [],
    notes: ''
  });

  const timeSlots = [
    { value: '09:00', label: '9:00 AM' },
    { value: '11:00', label: '11:00 AM' },
    { value: '14:00', label: '2:00 PM' },
    { value: '16:00', label: '4:00 PM' },
    { value: '18:00', label: '6:00 PM' },
  ];

  const daysOfWeek = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  useEffect(() => {
    fetchJourneys();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [filterJourney]);

  const fetchJourneys = async () => {
    try {
      const response = await fetch('/api/wellness-journeys', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setJourneys(data.journeys || []);
      }
    } catch (error) {
      console.error('Error fetching journeys:', error);
    }
  };

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const url = filterJourney === 'all'
        ? '/api/wellness-availability'
        : `/api/wellness-availability?journey_id=${filterJourney}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAvailability(data.availability);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/wellness-availability/stats/overview', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingSlot
        ? `/api/wellness-availability/${editingSlot.id}`
        : '/api/wellness-availability';

      const method = editingSlot ? 'PUT' : 'POST';

      // Calculate end time based on 90-minute duration
      const [startHours, startMinutes] = formData.start_time.split(':').map(Number);
      const endDate = new Date(2000, 0, 1, startHours, startMinutes);
      endDate.setMinutes(endDate.getMinutes() + 90);
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      const payload = {
        ...formData,
        end_time: endTime,
        days_of_week: formData.days_of_week.length > 0 ? formData.days_of_week : null
      };

      // If editing, only send changed fields
      if (editingSlot) {
        delete payload.journey_id;
        delete payload.start_date;
        delete payload.end_date;
        delete payload.days_of_week;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        alert(editingSlot ? 'Availability updated successfully!' : `Created ${data.count} availability slot(s)!`);
        fetchAvailability();
        fetchStats();
        closeModal();
      } else {
        alert(data.error || 'Failed to save availability');
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('An error occurred while saving');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this availability slot?')) return;

    try {
      const response = await fetch(`/api/wellness-availability/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        fetchAvailability();
        fetchStats();
      } else {
        alert(data.error || 'Failed to delete availability');
      }
    } catch (error) {
      console.error('Error deleting availability:', error);
      alert('An error occurred while deleting');
    }
  };

  const handleToggleAvailability = async (slot) => {
    try {
      const response = await fetch(`/api/wellness-availability/${slot.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_available: !slot.is_available
        })
      });

      const data = await response.json();
      if (data.success) {
        fetchAvailability();
        fetchStats();
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
    }
  };

  const openModal = (slot = null) => {
    if (slot) {
      setEditingSlot(slot);
      setFormData({
        journey_id: slot.journey_id,
        start_date: slot.available_date,
        end_date: '',
        start_time: slot.start_time.substring(0, 5),
        end_time: slot.end_time.substring(0, 5),
        max_capacity: slot.max_capacity,
        days_of_week: [],
        notes: slot.notes || ''
      });
    } else {
      setEditingSlot(null);
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        journey_id: journeys.length > 0 ? journeys[0].id : '',
        start_date: today,
        end_date: '',
        start_time: '09:00',
        end_time: '10:30',
        max_capacity: 3,
        days_of_week: [],
        notes: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSlot(null);
  };

  const toggleDayOfWeek = (day) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day]
    }));
  };

  const getCategoryColor = (category) => {
    const colors = {
      restore: 'blue',
      recharge: 'green',
      reflect: 'purple',
      explore: 'orange'
    };
    return colors[category] || 'gray';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      restore: '🧘',
      recharge: '⚡',
      reflect: '🌅',
      explore: '🌍'
    };
    return icons[category] || '✨';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const groupedAvailability = availability.reduce((acc, slot) => {
    const key = slot.available_date;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(slot);
    return acc;
  }, {});

  if (loading && availability.length === 0) {
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
        <h1 className="text-3xl font-heading text-gray-900">Wellness Journey Availability</h1>
        <p className="text-gray-600 mt-1">Manage time slots for wellness journey bookings</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <div className="text-sm text-gray-600">Total Slots</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_slots}</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4 border border-green-200">
            <div className="text-sm text-green-700">Available</div>
            <div className="text-2xl font-bold text-green-800">{stats.available_slots}</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4 border border-red-200">
            <div className="text-sm text-red-700">Fully Booked</div>
            <div className="text-2xl font-bold text-red-800">{stats.fully_booked_slots}</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4 border border-blue-200">
            <div className="text-sm text-blue-700">Capacity Used</div>
            <div className="text-2xl font-bold text-blue-800">
              {stats.total_capacity > 0 ? Math.round((stats.total_bookings / stats.total_capacity) * 100) : 0}%
            </div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilterJourney('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterJourney === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Journeys
          </button>
          {journeys.map(journey => (
            <button
              key={journey.id}
              onClick={() => setFilterJourney(journey.id.toString())}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterJourney === journey.id.toString()
                  ? `bg-${getCategoryColor(journey.category)}-600 text-white`
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {getCategoryIcon(journey.category)} {journey.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => openModal()}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
        >
          + Create Availability
        </button>
      </div>

      {/* Availability List - Grouped by Date */}
      <div className="space-y-6">
        {Object.keys(groupedAvailability).sort().map(date => (
          <div key={date} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Date Header */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
              <h3 className="text-xl font-semibold text-white">
                📅 {formatDate(date)}
              </h3>
            </div>

            {/* Time Slots for this date */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedAvailability[date].map(slot => (
                  <div
                    key={slot.id}
                    className={`border-2 rounded-lg p-4 ${
                      slot.is_available
                        ? 'border-gray-200 bg-white'
                        : 'border-gray-300 bg-gray-100 opacity-60'
                    }`}
                  >
                    {/* Journey Badge */}
                    <div className="mb-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${getCategoryColor(slot.journey_category)}-100 text-${getCategoryColor(slot.journey_category)}-800`}>
                        {getCategoryIcon(slot.journey_category)} {slot.journey_name}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="mb-3">
                      <div className="text-lg font-bold text-gray-900">
                        ⏰ {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                      </div>
                    </div>

                    {/* Capacity */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Capacity:</span>
                        <span className={`font-semibold ${
                          slot.current_bookings >= slot.max_capacity
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}>
                          {slot.current_bookings} / {slot.max_capacity}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${
                            slot.current_bookings >= slot.max_capacity
                              ? 'bg-red-600'
                              : 'bg-green-600'
                          }`}
                          style={{
                            width: `${(slot.current_bookings / slot.max_capacity) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Status Toggle */}
                    <div className="mb-3">
                      <button
                        onClick={() => handleToggleAvailability(slot)}
                        className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          slot.is_available
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {slot.is_available ? '✓ Active' : '✕ Disabled'}
                      </button>
                    </div>

                    {/* Notes */}
                    {slot.notes && (
                      <div className="mb-3 text-xs text-gray-600 bg-gray-50 rounded p-2">
                        📝 {slot.notes}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openModal(slot)}
                        className="flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(slot.id)}
                        className="flex-1 bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                        disabled={slot.current_bookings > 0}
                        title={slot.current_bookings > 0 ? 'Cannot delete slot with bookings' : ''}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {availability.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow">
          <p className="text-gray-500 text-lg">No availability slots found</p>
          <button
            onClick={() => openModal()}
            className="mt-4 text-primary-600 hover:text-primary-700 font-semibold"
          >
            Create your first availability slot
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-heading text-gray-900">
                {editingSlot ? 'Edit Availability Slot' : 'Create Availability Slots'}
              </h2>
              {!editingSlot && (
                <p className="text-sm text-gray-600 mt-1">
                  Create slots for a single date or multiple dates
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Journey Selection (only for new slots) */}
              {!editingSlot && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wellness Journey *
                  </label>
                  <select
                    value={formData.journey_id}
                    onChange={(e) => setFormData({ ...formData, journey_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="">Select a journey</option>
                    {journeys.map(journey => (
                      <option key={journey.id} value={journey.id}>
                        {getCategoryIcon(journey.category)} {journey.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                    disabled={editingSlot}
                  />
                </div>
                {!editingSlot && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      min={formData.start_date}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}
              </div>

              {/* Days of Week Filter (only when creating multiple dates) */}
              {!editingSlot && formData.end_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days of Week (Optional - Leave empty for all days)
                  </label>
                  <div className="flex space-x-2">
                    {daysOfWeek.map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDayOfWeek(day.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.days_of_week.includes(day.value)
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time * (Duration: 90 minutes)
                </label>
                <select
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                >
                  {timeSlots.map(slot => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Capacity *
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.max_capacity}
                  onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="e.g., Special event, limited availability"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Actions */}
              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
                >
                  {editingSlot ? 'Update Slot' : 'Create Slots'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WellnessAvailability;
