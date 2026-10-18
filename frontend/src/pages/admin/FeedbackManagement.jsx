import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const FeedbackManagement = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({});

  useEffect(() => {
    fetchFeedbacks();
    fetchStats();
  }, [filterStatus, filterType]);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.feedbackType = filterType;

      const response = await api.get('/feedback/admin/all', { params });

      if (response.data.success) {
        setFeedbacks(response.data.feedback);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/feedback/admin/stats');

      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const updateStatus = async (id, status, isFeatured = false, adminNotes = '') => {
    try {
      const response = await api.put(
        `/feedback/admin/${id}/status`,
        { status, isFeatured, adminNotes }
      );

      if (response.data.success) {
        fetchFeedbacks();
        fetchStats();
        setShowModal(false);
        alert(`Feedback ${status} successfully!`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const updateFeedback = async (id) => {
    try {
      const response = await api.put(
        `/feedback/admin/${id}`,
        editedData
      );

      if (response.data.success) {
        fetchFeedbacks();
        setEditMode(false);
        setShowModal(false);
        alert('Feedback updated successfully!');
      }
    } catch (error) {
      console.error('Error updating feedback:', error);
      alert('Failed to update feedback');
    }
  };

  const deleteFeedback = async (id) => {
    if (!window.confirm('Are you sure you want to delete this feedback? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/feedback/admin/${id}`);

      if (response.data.success) {
        fetchFeedbacks();
        fetchStats();
        setShowModal(false);
        alert('Feedback deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
      alert('Failed to delete feedback');
    }
  };

  const openModal = (feedback) => {
    setSelectedFeedback(feedback);
    setEditedData({
      name: feedback.name,
      role: feedback.role,
      testimonialText: feedback.testimonial_text,
      rating: feedback.rating,
      adminNotes: feedback.admin_notes
    });
    setShowModal(true);
    setEditMode(false);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'reviewed': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'testimonial': return 'bg-purple-100 text-purple-800';
      case 'general': return 'bg-blue-100 text-blue-800';
      case 'suggestion': return 'bg-green-100 text-green-800';
      case 'complaint': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <svg
        key={i}
        className={`w-5 h-5 ${i < rating ? 'text-primary-500' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Feedback Management</h1>
          <p className="text-gray-600 mt-1">Manage customer feedback and testimonials</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow-soft p-6">
            <div className="text-sm text-gray-600 mb-1">Total</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow-soft p-6">
            <div className="text-sm text-yellow-600 mb-1">Pending</div>
            <div className="text-3xl font-bold text-yellow-700">{stats.pending}</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow-soft p-6">
            <div className="text-sm text-blue-600 mb-1">Reviewed</div>
            <div className="text-3xl font-bold text-blue-700">{stats.reviewed}</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow-soft p-6">
            <div className="text-sm text-green-600 mb-1">Approved</div>
            <div className="text-3xl font-bold text-green-700">{stats.approved}</div>
          </div>
          <div className="bg-purple-50 rounded-lg shadow-soft p-6">
            <div className="text-sm text-purple-600 mb-1">Avg Rating</div>
            <div className="text-3xl font-bold text-purple-700">{stats.average_rating || 'N/A'}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-soft p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="testimonial">Testimonial</option>
              <option value="general">General Feedback</option>
              <option value="suggestion">Suggestion</option>
              <option value="complaint">Complaint</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feedback List */}
      <div className="bg-white rounded-lg shadow-soft overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            <p className="mt-4 text-gray-600">Loading feedback...</p>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No feedback found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {feedbacks.map((feedback) => (
                  <tr key={feedback.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{feedback.name}</div>
                      <div className="text-sm text-gray-500">{feedback.role || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeClass(feedback.feedback_type)}`}>
                        {feedback.feedback_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {feedback.rating ? renderStars(feedback.rating) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(feedback.status)}`}>
                        {feedback.status}
                      </span>
                      {feedback.is_featured && (
                        <span className="ml-2 text-primary-500">⭐</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openModal(feedback)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        View/Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editMode ? 'Edit Feedback' : 'Feedback Details'}
                  </h2>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(selectedFeedback.status)}`}>
                      {selectedFeedback.status}
                    </span>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getTypeBadgeClass(selectedFeedback.feedback_type)}`}>
                      {selectedFeedback.feedback_type}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="space-y-6">
                {/* Submitter Info */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Submitter Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {editMode ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                          <input
                            type="text"
                            value={editedData.name}
                            onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                          <input
                            type="text"
                            value={editedData.role || ''}
                            onChange={(e) => setEditedData({ ...editedData, role: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm"><strong>Name:</strong> {selectedFeedback.name}</p>
                        <p className="text-sm"><strong>Email:</strong> {selectedFeedback.email || 'N/A'}</p>
                        <p className="text-sm"><strong>Phone:</strong> {selectedFeedback.phone || 'N/A'}</p>
                        <p className="text-sm"><strong>Role:</strong> {selectedFeedback.role || 'N/A'}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Rating */}
                {selectedFeedback.rating && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Rating</h3>
                    <div className="flex items-center">{renderStars(selectedFeedback.rating)}</div>
                  </div>
                )}

                {/* Testimonial */}
                {selectedFeedback.testimonial_text && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Testimonial</h3>
                    {editMode ? (
                      <textarea
                        value={editedData.testimonialText || ''}
                        onChange={(e) => setEditedData({ ...editedData, testimonialText: e.target.value })}
                        rows="4"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm italic">"{selectedFeedback.testimonial_text}"</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Public Display: {selectedFeedback.allow_public_display ? 'Allowed' : 'Not Allowed'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* General Feedback */}
                {(selectedFeedback.what_went_well || selectedFeedback.areas_for_improvement || selectedFeedback.additional_comments) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Detailed Feedback</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      {selectedFeedback.what_went_well && (
                        <div>
                          <p className="text-xs font-medium text-green-700">What Went Well:</p>
                          <p className="text-sm mt-1">{selectedFeedback.what_went_well}</p>
                        </div>
                      )}
                      {selectedFeedback.areas_for_improvement && (
                        <div>
                          <p className="text-xs font-medium text-orange-700">Areas for Improvement:</p>
                          <p className="text-sm mt-1">{selectedFeedback.areas_for_improvement}</p>
                        </div>
                      )}
                      {selectedFeedback.additional_comments && (
                        <div>
                          <p className="text-xs font-medium text-blue-700">Additional Comments:</p>
                          <p className="text-sm mt-1">{selectedFeedback.additional_comments}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin Notes */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Admin Notes</h3>
                  <textarea
                    value={editedData.adminNotes || ''}
                    onChange={(e) => setEditedData({ ...editedData, adminNotes: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Internal notes (not visible to customer)..."
                  />
                </div>

                {/* Actions */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Actions</h3>
                  <div className="flex flex-wrap gap-3">
                    {editMode ? (
                      <>
                        <button
                          onClick={() => updateFeedback(selectedFeedback.id)}
                          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditMode(false)}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                        >
                          Cancel Edit
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditMode(true)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                          Edit
                        </button>
                        {selectedFeedback.status === 'pending' && (
                          <button
                            onClick={() => updateStatus(selectedFeedback.id, 'reviewed', false, editedData.adminNotes)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                          >
                            Mark as Reviewed
                          </button>
                        )}
                        {(selectedFeedback.status === 'pending' || selectedFeedback.status === 'reviewed') && (
                          <>
                            <button
                              onClick={() => updateStatus(selectedFeedback.id, 'approved', false, editedData.adminNotes)}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateStatus(selectedFeedback.id, 'approved', true, editedData.adminNotes)}
                              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                            >
                              Approve & Feature ⭐
                            </button>
                            <button
                              onClick={() => updateStatus(selectedFeedback.id, 'rejected', false, editedData.adminNotes)}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteFeedback(selectedFeedback.id)}
                          className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackManagement;
