import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../site/api';

const DepositBoxManagement = () => {
  const [depositBoxes, setDepositBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBox, setSelectedBox] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [boxHistory, setBoxHistory] = useState([]);
  const [deliveryForm, setDeliveryForm] = useState({
    delivered_by: '',
    tracking_number: '',
    package_description: '',
    notes: ''
  });


  useEffect(() => {
    fetchDepositBoxes();
  }, []);

  const fetchDepositBoxes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/deposit-box/admin/all`);
      if (response.data.success) {
        setDepositBoxes(response.data.depositBoxes);
      }
    } catch (error) {
      console.error('Error fetching deposit boxes:', error);
      alert('Failed to load deposit boxes');
    } finally {
      setLoading(false);
    }
  };

  const openBoxDetails = async (box) => {
    try {
      const response = await axios.get(`${API_URL}/deposit-box/admin/${box.id}`);
      if (response.data.success) {
        setSelectedBox(response.data.depositBox);
        setBoxHistory(response.data.history);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error loading box details:', error);
      alert('Failed to load deposit box details');
    }
  };

  const openDeliveryModal = (box) => {
    setSelectedBox(box);
    setDeliveryForm({
      delivered_by: '',
      tracking_number: '',
      package_description: '',
      notes: ''
    });
    setShowDeliveryModal(true);
  };

  const handleUseKey = async () => {
    if (!selectedBox) return;

    if (!selectedBox.current_booking_id) {
      alert('No active booking for this deposit box');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/deposit-box/admin/use-key`, {
        box_id: selectedBox.id,
        ...deliveryForm
      });

      if (response.data.success) {
        alert(`Package delivered successfully!\n\nOld PIN: ${response.data.oldPin}\nNew PIN: ${response.data.newPin}\n\nGuest: ${response.data.guestName}\nEmail: ${response.data.guestEmail}`);

        // Update the local state immediately for responsive UI
        setDepositBoxes(prevBoxes => prevBoxes.map(box =>
          box.id === selectedBox.id
            ? { ...box, current_pin: response.data.newPin, status: 'package_waiting', waiting_packages: (parseInt(box.waiting_packages) + 1).toString() }
            : box
        ));

        setShowDeliveryModal(false);
        setShowDetailModal(false);

        // Then refresh from server to ensure data consistency
        await fetchDepositBoxes();
      }
    } catch (error) {
      console.error('Error using deposit box key:', error);
      alert(error.response?.data?.message || 'Failed to record delivery');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      empty: 'bg-gray-100 text-gray-800',
      package_waiting: 'bg-green-100 text-green-800',
      maintenance: 'bg-yellow-100 text-yellow-800'
    };

    const labels = {
      empty: 'Empty',
      package_waiting: 'Package Waiting',
      maintenance: 'Maintenance'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading deposit boxes...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Deposit Box Management</h1>
        <p className="text-gray-600 mt-2">Manage package deliveries and deposit box access</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Total Boxes</div>
          <div className="text-2xl font-bold text-gray-800">{depositBoxes.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Empty</div>
          <div className="text-2xl font-bold text-gray-500">
            {depositBoxes.filter(b => b.status === 'empty').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Package Waiting</div>
          <div className="text-2xl font-bold text-green-600">
            {depositBoxes.filter(b => b.status === 'package_waiting').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Active Bookings</div>
          <div className="text-2xl font-bold text-blue-600">
            {depositBoxes.filter(b => b.current_booking_id).length}
          </div>
        </div>
      </div>

      {/* Deposit Boxes Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Box #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Apartment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current PIN
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Packages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {depositBoxes.map((box) => (
                <tr key={box.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {box.box_number}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {box.apartment_number || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(box.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono font-bold text-gray-900">
                      {box.current_pin || '----'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {box.guest_name || '-'}
                    </div>
                    {box.guest_email && (
                      <div className="text-xs text-gray-500">{box.guest_email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {box.waiting_packages > 0 ? (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                          {box.waiting_packages} waiting
                        </span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => openBoxDetails(box)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      View Details
                    </button>
                    {box.current_booking_id && (
                      <button
                        onClick={() => openDeliveryModal(box)}
                        className="text-green-600 hover:text-green-800"
                      >
                        Use Key
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedBox && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Deposit Box {selectedBox.box_number}
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            {/* Box Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-sm text-gray-600">Status</div>
                <div className="mt-1">{getStatusBadge(selectedBox.status)}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-sm text-gray-600">Current PIN</div>
                <div className="mt-1 text-2xl font-mono font-bold text-gray-900">
                  {selectedBox.current_pin || '----'}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-sm text-gray-600">Apartment</div>
                <div className="mt-1 text-lg font-medium text-gray-900">
                  {selectedBox.apartment_number || 'N/A'}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-sm text-gray-600">PIN Last Changed</div>
                <div className="mt-1 text-sm text-gray-900">
                  {formatDate(selectedBox.pin_changed_at)}
                </div>
              </div>
            </div>

            {/* Guest Info */}
            {selectedBox.guest_name && (
              <div className="mb-6 bg-blue-50 p-4 rounded">
                <h3 className="font-semibold text-gray-800 mb-2">Current Guest</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Name</div>
                    <div className="text-gray-900">{selectedBox.guest_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Email</div>
                    <div className="text-gray-900">{selectedBox.guest_email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="text-sm text-gray-600">Check In</div>
                    <div className="text-gray-900">{formatDate(selectedBox.check_in_date)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Check Out</div>
                    <div className="text-gray-900">{formatDate(selectedBox.check_out_date)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Package History */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Package History</h3>
              {boxHistory.length > 0 ? (
                <div className="space-y-3">
                  {boxHistory.map((history) => (
                    <div key={history.id} className="border rounded p-3 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium text-gray-900">
                            {history.package_description || 'Package'}
                          </div>
                          <div className="text-sm text-gray-600">
                            Delivered by: {history.delivered_by}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          history.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                          history.status === 'collected' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {history.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Tracking: </span>
                          <span className="text-gray-900">{history.tracking_number || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Delivered: </span>
                          <span className="text-gray-900">{formatDate(history.delivery_date)}</span>
                        </div>
                        {history.collected_at && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Collected: </span>
                            <span className="text-gray-900">{formatDate(history.collected_at)}</span>
                          </div>
                        )}
                        {history.notes && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Notes: </span>
                            <span className="text-gray-900">{history.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">No package history</div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              {selectedBox.current_booking_id && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openDeliveryModal(selectedBox);
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Record Delivery (Use Key)
                </button>
              )}
              <button
                onClick={() => setShowDetailModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Modal */}
      {showDeliveryModal && selectedBox && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Record Package Delivery - Box {selectedBox.box_number}
            </h2>

            <div className="mb-4 bg-blue-50 p-3 rounded">
              <div className="text-sm text-gray-600">Current PIN (will be shown to delivery person)</div>
              <div className="text-2xl font-mono font-bold text-gray-900 mt-1">
                {selectedBox.current_pin}
              </div>
            </div>

            <div className="mb-4 bg-yellow-50 p-3 rounded">
              <div className="text-sm font-medium text-yellow-800">
                After delivery is recorded:
              </div>
              <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
                <li>A new PIN will be generated for the guest</li>
                <li>Guest will receive a notification</li>
                <li>Package will appear in delivery history</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivered By
                </label>
                <input
                  type="text"
                  value={deliveryForm.delivered_by}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, delivered_by: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="e.g., FedEx, UPS, DHL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={deliveryForm.tracking_number}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, tracking_number: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Package Description
                </label>
                <input
                  type="text"
                  value={deliveryForm.package_description}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, package_description: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="e.g., Small box, Large envelope"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={deliveryForm.notes}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  rows="3"
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowDeliveryModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleUseKey}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Confirm Delivery (Use Key)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepositBoxManagement;
