import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const WellnessActivities = () => {
  const { token } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [filterMood, setFilterMood] = useState('all');
  const [formData, setFormData] = useState({
    mood_category: 'restore',
    name: '',
    description: '',
    duration: '',
    image_url: '',
    features: []
  });

  const moodCategories = [
    { value: 'restore', label: 'Restore', icon: '🧘', color: 'blue' },
    { value: 'recharge', label: 'Recharge', icon: '⚡', color: 'green' },
    { value: 'reflect', label: 'Reflect', icon: '🌅', color: 'purple' },
    { value: 'explore', label: 'Explore', icon: '🌍', color: 'orange' }
  ];

  useEffect(() => {
    fetchActivities();
  }, [filterMood]);

  const fetchActivities = async () => {
    try {
      const url = filterMood === 'all'
        ? '/api/wellness/activities'
        : `/api/wellness/activities?mood=${filterMood}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setActivities(data.activities);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingActivity
        ? `/api/wellness/activities/${editingActivity.id}`
        : '/api/wellness/activities';

      const method = editingActivity ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        fetchActivities();
        closeModal();
      }
    } catch (error) {
      console.error('Error saving activity:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this activity?')) return;

    try {
      const response = await fetch(`/api/wellness/activities/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        fetchActivities();
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
    }
  };

  const openModal = (activity = null) => {
    if (activity) {
      setEditingActivity(activity);
      setFormData({
        mood_category: activity.mood_category,
        name: activity.name,
        description: activity.description || '',
        duration: activity.duration || '',
        image_url: activity.image_url || '',
        features: activity.features || []
      });
    } else {
      setEditingActivity(null);
      setFormData({
        mood_category: 'restore',
        name: '',
        description: '',
        duration: '',
        image_url: '',
        features: []
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingActivity(null);
  };

  const getMoodColor = (mood) => {
    const moodObj = moodCategories.find(m => m.value === mood);
    return moodObj ? moodObj.color : 'gray';
  };

  const getMoodIcon = (mood) => {
    const moodObj = moodCategories.find(m => m.value === mood);
    return moodObj ? moodObj.icon : '📝';
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
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading text-gray-900">Wellness Activities</h1>
          <p className="text-gray-600 mt-1">Manage mood-based wellness activities for guests</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
        >
          + Add Activity
        </button>
      </div>

      {/* Mood Filter */}
      <div className="mb-6 flex space-x-2">
        <button
          onClick={() => setFilterMood('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filterMood === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Activities
        </button>
        {moodCategories.map(mood => (
          <button
            key={mood.value}
            onClick={() => setFilterMood(mood.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterMood === mood.value
                ? `bg-${mood.color}-600 text-white`
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {mood.icon} {mood.label}
          </button>
        ))}
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activities.map(activity => (
          <div
            key={activity.id}
            className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow"
          >
            {/* Image */}
            {activity.image_url && (
              <div className="h-48 bg-gray-200">
                <img
                  src={activity.image_url}
                  alt={activity.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6">
              {/* Mood Badge */}
              <div className="mb-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${getMoodColor(activity.mood_category)}-100 text-${getMoodColor(activity.mood_category)}-800`}>
                  {getMoodIcon(activity.mood_category)} {activity.mood_category}
                </span>
              </div>

              {/* Name & Duration */}
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {activity.name}
              </h3>
              {activity.duration && (
                <p className="text-sm text-gray-600 mb-3">⏱ {activity.duration}</p>
              )}

              {/* Description */}
              {activity.description && (
                <p className="text-gray-700 mb-4 line-clamp-2">
                  {activity.description}
                </p>
              )}

              {/* Features */}
              {activity.features && activity.features.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {activity.features.map((feature, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => openModal(activity)}
                  className="flex-1 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(activity.id)}
                  className="flex-1 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activities.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No activities found</p>
          <button
            onClick={() => openModal()}
            className="mt-4 text-primary-600 hover:text-primary-700 font-semibold"
          >
            Create your first activity
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-heading text-gray-900">
                {editingActivity ? 'Edit Activity' : 'Add New Activity'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Mood Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mood Category
                </label>
                <select
                  value={formData.mood_category}
                  onChange={(e) => setFormData({ ...formData, mood_category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                >
                  {moodCategories.map(mood => (
                    <option key={mood.value} value={mood.value}>
                      {mood.icon} {mood.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Activity Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration
                </label>
                <input
                  type="text"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="e.g., 60 min, Open 24/7, Daily schedule"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Features (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.features.join(', ')}
                  onChange={(e) => setFormData({
                    ...formData,
                    features: e.target.value.split(',').map(f => f.trim()).filter(f => f)
                  })}
                  placeholder="Spa, Sauna, Massage"
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
                  {editingActivity ? 'Update' : 'Create'} Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WellnessActivities;
