import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../site/api';

const WellnessZones = () => {
  const { token } = useAuth();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subtitle: '',
    image_url: '',
    features: [],
    glyph: ''
  });

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const response = await fetch(`${API_URL}/wellness/zones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setZones(data.zones);
      }
    } catch (error) {
      console.error('Error fetching zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingZone
        ? `${API_URL}/wellness/zones/${editingZone.id}`
        : `${API_URL}/wellness/zones`;

      const method = editingZone ? 'PUT' : 'POST';

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
        fetchZones();
        closeModal();
      }
    } catch (error) {
      console.error('Error saving zone:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this zone?')) return;

    try {
      const response = await fetch(`${API_URL}/wellness/zones/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        fetchZones();
      }
    } catch (error) {
      console.error('Error deleting zone:', error);
    }
  };

  const openModal = (zone = null) => {
    if (zone) {
      setEditingZone(zone);
      setFormData({
        name: zone.name,
        description: zone.description || '',
        subtitle: zone.subtitle || '',
        image_url: zone.image_url || '',
        features: zone.features || [],
        glyph: zone.glyph || ''
      });
    } else {
      setEditingZone(null);
      setFormData({
        name: '',
        description: '',
        subtitle: '',
        image_url: '',
        features: [],
        glyph: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingZone(null);
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
          <h1 className="text-3xl font-heading text-gray-900">Wellness Zones</h1>
          <p className="text-gray-600 mt-1">Manage estate zones and their amenities</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
        >
          + Add Zone
        </button>
      </div>

      {/* Zones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {zones.map(zone => (
          <div
            key={zone.id}
            className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow"
          >
            {/* Image */}
            {zone.image_url && (
              <div className="h-48 bg-gray-200">
                <img
                  src={zone.image_url}
                  alt={zone.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6">
              {/* Name & Location */}
              <div className="flex items-center mb-2">
                {zone.glyph && <span className="text-2xl mr-2">{zone.glyph}</span>}
                <h3 className="text-xl font-semibold text-gray-900">
                  {zone.name}
                </h3>
              </div>
              {zone.subtitle && (
                <p className="text-sm text-gray-600 mb-3 flex items-center">
                  <span className="mr-1">📍</span> {zone.subtitle}
                </p>
              )}

              {/* Description */}
              {zone.description && (
                <p className="text-gray-700 mb-4 line-clamp-2">
                  {zone.description}
                </p>
              )}

              {/* Features */}
              {zone.features && zone.features.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Features:</p>
                  <div className="flex flex-wrap gap-2">
                    {zone.features.map((feature, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"
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
                  onClick={() => openModal(zone)}
                  className="flex-1 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(zone.id)}
                  className="flex-1 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {zones.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No zones found</p>
          <button
            onClick={() => openModal()}
            className="mt-4 text-primary-600 hover:text-primary-700 font-semibold"
          >
            Create your first zone
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-heading text-gray-900">
                {editingZone ? 'Edit Zone' : 'Add New Zone'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zone Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subtitle / Location
                </label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="e.g., Ground Floor, East Wing"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Glyph */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon / Glyph (emoji)
                </label>
                <input
                  type="text"
                  value={formData.glyph}
                  onChange={(e) => setFormData({ ...formData, glyph: e.target.value })}
                  placeholder="e.g., 🧘 🏊 💪"
                  maxLength={10}
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
                    features: e.target.value.split(',').map(a => a.trim()).filter(a => a)
                  })}
                  placeholder="Pool, Sauna, Gym, Meditation Garden"
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
                  {editingZone ? 'Update' : 'Create'} Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WellnessZones;
