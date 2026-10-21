import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../site/api';

// The wellness catalogue the guest app books from: multi-stage journeys and single services.
const CATEGORIES = [
  { value: 'restore', label: 'Restore', icon: '🌿', color: 'blue' },
  { value: 'recharge', label: 'Recharge', icon: '⚡', color: 'green' },
  { value: 'reflect', label: 'Reflect', icon: '🌅', color: 'purple' },
  { value: 'explore', label: 'Explore', icon: '🌍', color: 'orange' },
  { value: 'spa', label: 'Spa', icon: '💆', color: 'pink' },
  { value: 'fitness', label: 'Fitness', icon: '💪', color: 'green' },
  { value: 'dining', label: 'Dining', icon: '🍽️', color: 'yellow' },
  { value: 'other', label: 'Other', icon: '✨', color: 'gray' },
];
const categoryOf = (value) => CATEGORIES.find((c) => c.value === value) || CATEGORIES[CATEGORIES.length - 1];

const EMPTY = {
  type: 'service',
  category: 'restore',
  name: '',
  description: '',
  duration: 60,
  max_capacity: 1,
  base_price: 0,
  image_url: '',
  benefits: '',
  requires_staff: false,
  is_active: true,
};

const WellnessActivities = () => {
  const { token } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [filter, setFilter] = useState('all');
  const [formData, setFormData] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const request = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.error || data.message || 'Something went wrong');
      return data;
    },
    [token],
  );

  const fetchActivities = useCallback(async () => {
    try {
      setError('');
      const data = await request(`/wellness/activities?all=true${filter === 'all' ? '' : `&category=${filter}`}`);
      setActivities(data.activities);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, request]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const body = {
        ...formData,
        duration: Number(formData.duration),
        max_capacity: Number(formData.max_capacity),
        base_price: Number(formData.base_price) || 0,
        benefits: formData.benefits.split(',').map((b) => b.trim()).filter(Boolean),
      };
      if (editingActivity) {
        delete body.type; // a journey's stages define it; the type stays as created
        await request(`/wellness/activities/${editingActivity.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await request('/wellness/activities', { method: 'POST', body: JSON.stringify(body) });
      }
      closeModal();
      fetchActivities();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (activity, isActive) => {
    if (!isActive && !window.confirm(`Remove "${activity.name}" from the guest app? Existing bookings are kept.`)) return;
    try {
      if (isActive) await request(`/wellness/activities/${activity.id}`, { method: 'PUT', body: JSON.stringify({ is_active: true }) });
      else await request(`/wellness/activities/${activity.id}`, { method: 'DELETE' });
      fetchActivities();
    } catch (e) {
      setError(e.message);
    }
  };

  const openModal = (activity = null) => {
    setFormError('');
    setEditingActivity(activity);
    setFormData(
      activity
        ? {
            type: activity.type,
            category: activity.category,
            name: activity.name,
            description: activity.description || '',
            duration: activity.duration,
            max_capacity: activity.max_capacity || 1,
            base_price: Number(activity.base_price) || 0,
            image_url: activity.image_url || '',
            benefits: (activity.benefits || []).join(', '),
            requires_staff: Boolean(activity.requires_staff),
            is_active: activity.is_active !== false,
          }
        : EMPTY,
    );
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingActivity(null);
  };

  const field = (name) => ({
    value: formData[name],
    onChange: (e) => setFormData({ ...formData, [name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-heading text-gray-900">Wellness Activities</h1>
          <p className="text-gray-600 mt-1">Journeys and services guests can book in the Faysha app</p>
        </div>
        <button onClick={() => openModal()} className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold">
          + Add Activity
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === c.value ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activities.map((activity) => {
          const cat = categoryOf(activity.category);
          return (
            <div key={activity.id} className={`bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 ${activity.is_active ? '' : 'opacity-60'}`}>
              {activity.image_url && (
                <div className="h-40 bg-gray-200">
                  <img src={activity.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-6">
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                    {cat.icon} {cat.label}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                    {activity.type === 'journey' ? `Journey · ${activity.total_stages || 0} stages` : 'Service'}
                  </span>
                  {!activity.is_active && <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">Not offered</span>}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {activity.icon} {activity.display_name || activity.name}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  ⏱ {activity.duration} min · 👥 up to {activity.max_capacity || 1} per session ·{' '}
                  {Number(activity.base_price) > 0 ? `${Number(activity.base_price).toLocaleString()} XAF` : 'Included'}
                </p>
                {activity.description && <p className="text-gray-700 mb-4 line-clamp-2">{activity.description}</p>}
                {activity.benefits?.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {activity.benefits.map((b) => (
                      <span key={b} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <button onClick={() => openModal(activity)} className="flex-1 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 font-medium">
                    Edit
                  </button>
                  {activity.is_active ? (
                    <button onClick={() => setActive(activity, false)} className="flex-1 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium">
                      Remove
                    </button>
                  ) : (
                    <button onClick={() => setActive(activity, true)} className="flex-1 bg-green-50 text-green-700 px-4 py-2 rounded-lg hover:bg-green-100 font-medium">
                      Offer again
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activities.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No activities in this category yet</p>
          <button onClick={() => openModal()} className="mt-4 text-primary-600 hover:text-primary-700 font-semibold">
            Add the first one
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="activity-title">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 id="activity-title" className="text-2xl font-heading text-gray-900">
                {editingActivity ? 'Edit Activity' : 'Add Activity'}
              </h2>
              {editingActivity?.type === 'journey' && <p className="text-sm text-gray-600 mt-1">Journey stages are shown in the app in order; the duration is the whole journey.</p>}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-2">Category</span>
                  <select {...field('category')} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                {!editingActivity && (
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-2">Type</span>
                    <select {...field('type')} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                      <option value="service">Service (one session)</option>
                      <option value="journey">Journey (several stages)</option>
                    </select>
                  </label>
                )}
              </div>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">Name</span>
                <input type="text" {...field('name')} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</span>
                  <input type="number" min="5" max="1440" step="5" {...field('duration')} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-2">Guests per session</span>
                  <input type="number" min="1" {...field('max_capacity')} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-2">Price (XAF, 0 = included)</span>
                  <input type="number" min="0" step="500" {...field('base_price')} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </label>
              </div>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">Description</span>
                <textarea {...field('description')} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">Benefits (comma-separated)</span>
                <input type="text" {...field('benefits')} placeholder="Deep relaxation, Better sleep" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">Image URL</span>
                <input type="url" {...field('image_url')} placeholder="https://…" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              </label>
              <div className="flex flex-wrap gap-6">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={formData.requires_staff} onChange={field('requires_staff').onChange} />
                  <span className="text-sm text-gray-700">Needs a therapist or instructor</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={formData.is_active} onChange={field('is_active').onChange} />
                  <span className="text-sm text-gray-700">Offered in the app</span>
                </label>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-60">
                  {saving ? 'Saving…' : editingActivity ? 'Save changes' : 'Create activity'}
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
