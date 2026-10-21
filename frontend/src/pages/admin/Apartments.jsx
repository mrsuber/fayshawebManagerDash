import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FileUploader from '../../components/FileUploader';
import { API_URL } from '../../site/api';

const Apartments = () => {
  const [apartments, setApartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [editingApartment, setEditingApartment] = useState(null);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [uploadMediaType, setUploadMediaType] = useState('image');

  const [formData, setFormData] = useState({
    category_id: '',
    unit_number: '',
    floor: '',
    building: '',
    status: 'available',
    custom_price: '',
    notes: '',
    special_features: []
  });


  useEffect(() => {
    fetchData();
  }, [filterCategory, filterStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch categories
      const categoriesRes = await axios.get(`${API_URL}/apartments/categories`);
      if (categoriesRes.data.success) {
        setCategories(categoriesRes.data.categories);
      }

      // Fetch apartments
      let apartmentsUrl = `${API_URL}/apartments`;
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.append('category_id', filterCategory);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (params.toString()) apartmentsUrl += '?' + params.toString();

      const apartmentsRes = await axios.get(apartmentsUrl);
      if (apartmentsRes.data.success) {
        setApartments(apartmentsRes.data.apartments);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const dataToSend = {
        ...formData,
        floor: formData.floor ? parseInt(formData.floor) : null,
        custom_price: formData.custom_price ? parseFloat(formData.custom_price) : null,
        category_id: parseInt(formData.category_id)
      };

      if (editingApartment) {
        await axios.put(
          `${API_URL}/apartments/${editingApartment.id}`,
          dataToSend
        );
        alert('Apartment updated successfully');
      } else {
        await axios.post(`${API_URL}/apartments`, dataToSend);
        alert('Apartment created successfully');
      }

      fetchData();
      closeModal();
    } catch (error) {
      console.error('Error saving apartment:', error);
      alert('Failed to save apartment: ' + (error.response?.data?.message || error.message));
    }
  };

  const openModal = (apartment = null) => {
    if (apartment) {
      setEditingApartment(apartment);
      setFormData({
        category_id: apartment.category_id,
        unit_number: apartment.unit_number,
        floor: apartment.floor || '',
        building: apartment.building || '',
        status: apartment.status,
        custom_price: apartment.custom_price || '',
        notes: apartment.notes || '',
        special_features: apartment.special_features || []
      });
    } else {
      setEditingApartment(null);
      setFormData({
        category_id: categories[0]?.id || '',
        unit_number: '',
        floor: '',
        building: '',
        status: 'available',
        custom_price: '',
        notes: '',
        special_features: []
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingApartment(null);
  };

  const openMediaModal = async (apartment) => {
    try {
      const response = await axios.get(`${API_URL}/apartments/${apartment.id}`);
      if (response.data.success) {
        setSelectedApartment(response.data.apartment);
        setShowMediaModal(true);
      }
    } catch (error) {
      console.error('Error loading apartment details:', error);
      alert('Failed to load apartment details');
    }
  };

  const closeMediaModal = () => {
    setShowMediaModal(false);
    setSelectedApartment(null);
  };

  const handleMediaUpload = (response) => {
    if (response.success) {
      alert(`${response.media.length} file(s) uploaded successfully`);
      fetchData();
      if (selectedApartment) {
        openMediaModal(selectedApartment); // Refresh media
      }
    }
  };

  const setPrimaryImage = async (mediaId) => {
    try {
      await axios.put(`${API_URL}/apartments/media/${mediaId}/set-primary`);
      alert('Primary image updated');
      openMediaModal(selectedApartment); // Refresh
    } catch (error) {
      console.error('Error setting primary image:', error);
      alert('Failed to set primary image');
    }
  };

  const deleteMedia = async (mediaId) => {
    if (!window.confirm('Delete this media file?')) return;

    try {
      await axios.delete(`${API_URL}/apartments/media/${mediaId}`);
      alert('Media deleted');
      openMediaModal(selectedApartment); // Refresh
    } catch (error) {
      console.error('Error deleting media:', error);
      alert('Failed to delete media');
    }
  };

  const deleteApartment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this apartment? This cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/apartments/${id}`);
      alert('Apartment deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting apartment:', error);
      alert('Failed to delete apartment: ' + (error.response?.data?.message || error.message));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'occupied': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'unavailable': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading apartments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Apartments</h1>
            <p className="text-gray-600 mt-1">Manage individual apartment units</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Apartment</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Category
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.display_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-lg text-gray-900">{apartments.length}</span> apartment(s) found
              </div>
            </div>
          </div>
        </div>

        {/* Apartments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apartments.map((apartment) => (
            <div key={apartment.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {/* Apartment Image */}
              {apartment.primary_image ? (
                <img
                  src={apartment.primary_image}
                  alt={apartment.unit_number}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-500">No image</p>
                  </div>
                </div>
              )}

              <div className="absolute top-2 right-2 flex space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apartment.status)}`}>
                  {apartment.status}
                </span>
                {apartment.media_count > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{apartment.media_count}</span>
                  </span>
                )}
              </div>

              {/* Apartment Details */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Unit {apartment.unit_number}</h3>
                    <p className="text-sm text-gray-500">{apartment.category_display_name}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {apartment.building && (
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>Building: {apartment.building}</span>
                    </div>
                  )}
                  {apartment.floor !== null && (
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Floor: {apartment.floor}</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-primary-600">
                      {parseInt(apartment.effective_price).toLocaleString()} XAF/night
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openMediaModal(apartment)}
                    className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-3 rounded-lg text-sm flex items-center justify-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Media</span>
                  </button>
                  <button
                    onClick={() => openModal(apartment)}
                    className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg text-sm flex items-center justify-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit</span>
                  </button>
                </div>

                <button
                  onClick={() => deleteApartment(apartment.id)}
                  className="w-full mt-2 bg-red-50 hover:bg-red-100 text-red-600 py-2 px-3 rounded-lg text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {apartments.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-500 text-lg">No apartments found. Create your first apartment!</p>
          </div>
        )}
      </div>

      {/* Add/Edit Apartment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full my-8">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingApartment ? 'Edit Apartment' : 'Add New Apartment'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.display_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit Number *
                    </label>
                    <input
                      type="text"
                      value={formData.unit_number}
                      onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., A101, B205"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Building
                    </label>
                    <input
                      type="text"
                      value={formData.building}
                      onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., Building A"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Floor
                    </label>
                    <input
                      type="number"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., 3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="available">Available</option>
                      <option value="occupied">Occupied</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Price (XAF/night)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.custom_price}
                      onChange={(e) => setFormData({ ...formData, custom_price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      placeholder="Leave empty to use category price"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    rows="3"
                    placeholder="Internal notes about this apartment..."
                  />
                </div>

                <div className="flex justify-end space-x-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                  >
                    {editingApartment ? 'Update' : 'Create'} Apartment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Media Management Modal */}
      {showMediaModal && selectedApartment && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={closeMediaModal}
        >
          <div
            className="bg-white rounded-lg max-w-6xl w-full my-8 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header with Close Button */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg z-10">
              <h2 className="text-2xl font-bold">
                Media Gallery - Unit {selectedApartment.unit_number}
              </h2>
              <button
                onClick={closeMediaModal}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto flex-1">

              {/* File Uploader */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Upload New Media</h3>

                {/* Media Type Selector */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Media Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setUploadMediaType('image')}
                      className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                        uploadMediaType === 'image'
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">📷 Photo</span>
                      <span className="text-xs mt-1">Regular images</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUploadMediaType('panorama_360')}
                      className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                        uploadMediaType === 'panorama_360'
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium">🌐 360° Panorama</span>
                      <span className="text-xs mt-1">Immersive view</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUploadMediaType('video')}
                      className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                        uploadMediaType === 'video'
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">🎥 Video</span>
                      <span className="text-xs mt-1">Video tours</span>
                    </button>
                  </div>

                  {/* Help Text */}
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      {uploadMediaType === 'image' && '📷 Upload regular photos of the apartment (JPG, PNG, GIF)'}
                      {uploadMediaType === 'panorama_360' && '🌐 Upload 360° panorama images for immersive viewing experience'}
                      {uploadMediaType === 'video' && '🎥 Upload video tours of the apartment (MP4, MOV, AVI)'}
                    </p>
                  </div>
                </div>

                <FileUploader
                  key={selectedApartment.id}
                  onUpload={handleMediaUpload}
                  uploadEndpoint={`${API_URL}/apartments/media/upload`}
                  additionalData={{
                    apartment_id: selectedApartment.id,
                    media_type: uploadMediaType
                  }}
                  maxFiles={20}
                  acceptedTypes={uploadMediaType === 'video' ? 'video/*' : 'image/*'}
                />
              </div>

              {/* Existing Media */}
              {selectedApartment.media && selectedApartment.media.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      Existing Media ({selectedApartment.media.length})
                    </h3>
                    <p className="text-sm text-gray-500">
                      💡 Hover over images to set primary or delete
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {selectedApartment.media.map((media) => (
                      <div key={media.id} className="relative group">
                        {/* Media Preview */}
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                          {media.media_type === 'image' || media.media_type === 'panorama_360' ? (
                            <img
                              src={media.file_url}
                              alt={media.title || 'Apartment'}
                              className="w-full h-full object-cover"
                            />
                          ) : media.media_type === 'video' ? (
                            <video
                              src={media.file_url}
                              className="w-full h-full object-cover"
                              controls
                            />
                          ) : null}

                          {/* Badges */}
                          <div className="absolute top-2 left-2 flex flex-col space-y-1">
                            {media.is_primary && (
                              <span className="px-2 py-1 bg-yellow-500 text-white text-xs rounded font-medium">
                                ⭐ Primary
                              </span>
                            )}
                            <span className={`px-2 py-1 text-xs rounded font-medium ${
                              media.media_type === 'image' ? 'bg-blue-500 text-white' :
                              media.media_type === 'video' ? 'bg-purple-500 text-white' :
                              media.media_type === 'panorama_360' ? 'bg-green-500 text-white' :
                              'bg-gray-500 text-white'
                            }`}>
                              {media.media_type === 'image' ? '📷 Photo' :
                               media.media_type === 'video' ? '🎥 Video' :
                               media.media_type === 'panorama_360' ? '360°' : 'File'}
                            </span>
                          </div>

                          {/* Action Buttons - Always visible on mobile, hover on desktop */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-100 md:opacity-0 md:bg-black md:bg-opacity-0 group-hover:opacity-100 group-hover:bg-opacity-60 transition-all flex items-end md:items-center justify-center p-3">
                            <div className="flex space-x-2">
                              {!media.is_primary && (
                                <button
                                  onClick={() => setPrimaryImage(media.id)}
                                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg shadow-lg transform hover:scale-105 transition-all flex items-center space-x-1"
                                  title="Set as primary image"
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  <span className="text-xs font-medium hidden sm:inline">Set Primary</span>
                                </button>
                              )}
                              {media.is_primary && (
                                <button
                                  disabled
                                  className="bg-gray-400 cursor-not-allowed text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-1"
                                  title="Already primary image"
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  <span className="text-xs font-medium hidden sm:inline">Is Primary</span>
                                </button>
                              )}
                              <button
                                onClick={() => deleteMedia(media.id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg transform hover:scale-105 transition-all flex items-center space-x-1"
                                title="Delete this media"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span className="text-xs font-medium hidden sm:inline">Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Media Title */}
                        {media.title && (
                          <p className="mt-2 text-sm font-medium text-gray-900 truncate">
                            {media.title}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!selectedApartment.media || selectedApartment.media.length === 0) && (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No media files yet. Upload some photos or videos!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Apartments;
