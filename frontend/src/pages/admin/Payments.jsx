import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../site/api';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundData, setRefundData] = useState({
    refund_amount: '',
    refund_reason: ''
  });
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');


  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch statistics
      const statsRes = await axios.get(`${API_URL}/payments/stats/overview`);
      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }

      // Fetch payments with filters
      let paymentsUrl = `${API_URL}/payments`;
      const params = new URLSearchParams();

      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      if (params.toString()) {
        paymentsUrl += '?' + params.toString();
      }

      const paymentsRes = await axios.get(paymentsUrl);
      if (paymentsRes.data.success) {
        setPayments(paymentsRes.data.payments);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load payments data');
    } finally {
      setLoading(false);
    }
  };

  const openDetailModal = async (payment) => {
    try {
      const response = await axios.get(`${API_URL}/payments/${payment.id}`);
      if (response.data.success) {
        setSelectedPayment(response.data.payment);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error loading payment details:', error);
      alert('Failed to load payment details');
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedPayment(null);
  };

  const openRefundModal = (payment) => {
    setSelectedPayment(payment);
    setRefundData({
      refund_amount: payment.amount,
      refund_reason: ''
    });
    setShowRefundModal(true);
  };

  const closeRefundModal = () => {
    setShowRefundModal(false);
    setSelectedPayment(null);
    setRefundData({
      refund_amount: '',
      refund_reason: ''
    });
  };

  const processRefund = async () => {
    if (!refundData.refund_reason.trim()) {
      alert('Please provide a refund reason');
      return;
    }

    if (!window.confirm(`Are you sure you want to refund ${parseFloat(refundData.refund_amount).toLocaleString()} XAF?`)) {
      return;
    }

    try {
      await axios.post(`${API_URL}/payments/${selectedPayment.id}/refund`, refundData);
      alert('Refund processed successfully');
      closeRefundModal();
      fetchData();
    } catch (error) {
      console.error('Error processing refund:', error);
      alert('Failed to process refund: ' + (error.response?.data?.message || error.message));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentMethodBadge = (method) => {
    switch (method) {
      case 'stripe':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
            </svg>
            Stripe
          </span>
        );
      case 'cash':
        return <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">Cash</span>;
      case 'bank_transfer':
        return <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">Bank Transfer</span>;
      default:
        return <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">{method}</span>;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter payments by search query
  const filteredPayments = payments.filter(payment => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      payment.booking_number?.toLowerCase().includes(query) ||
      payment.guest_name?.toLowerCase().includes(query) ||
      payment.guest_email?.toLowerCase().includes(query) ||
      payment.transaction_reference?.toLowerCase().includes(query) ||
      payment.stripe_payment_intent_id?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Payments Management</h1>
          <p className="text-gray-600 mt-1">Track payments and process refunds</p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Payments</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_payments || 0}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{stats.completed_payments || 0}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending_payments || 0}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-primary-600 mt-2">
                    {parseInt(stats.total_revenue || 0).toLocaleString()} XAF
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Additional Stats Row */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {parseInt(stats.today_revenue || 0).toLocaleString()} XAF
                  </p>
                </div>
                <div className="text-green-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed Payments</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{stats.failed_payments || 0}</p>
                </div>
                <div className="text-red-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Refunds</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">
                    {parseInt(stats.total_refunds || 0).toLocaleString()} XAF
                  </p>
                </div>
                <div className="text-purple-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Booking #, guest name, email, transaction ID..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <span className="font-semibold text-lg text-gray-900">{filteredPayments.length}</span> payment(s) found
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Booking
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
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
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{payment.booking_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{payment.guest_name}</div>
                        <div className="text-sm text-gray-500">{payment.guest_email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {parseInt(payment.amount).toLocaleString()} {payment.currency}
                      </div>
                      {payment.refund_amount > 0 && (
                        <div className="text-xs text-purple-600">
                          Refunded: {parseInt(payment.refund_amount).toLocaleString()} {payment.currency}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPaymentMethodBadge(payment.payment_method)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(payment.created_at)}</div>
                      {payment.paid_at && (
                        <div className="text-xs text-gray-500">Paid: {formatDate(payment.paid_at)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-y-1">
                      <button
                        onClick={() => openDetailModal(payment)}
                        className="text-primary-600 hover:text-primary-900 font-medium block"
                      >
                        View Details
                      </button>
                      {payment.status === 'completed' && (
                        <button
                          onClick={() => openRefundModal(payment)}
                          className="text-purple-600 hover:text-purple-900 font-medium block"
                        >
                          Process Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No payments found</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Detail Modal */}
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-3xl w-full my-8">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Payment Details</h2>
                  <p className="text-gray-600">{selectedPayment.booking_number}</p>
                </div>
                <button
                  onClick={closeDetailModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Payment Status */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Payment Status</h3>
                  <div className="flex items-center justify-between">
                    <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(selectedPayment.status)}`}>
                      {selectedPayment.status}
                    </span>
                    {getPaymentMethodBadge(selectedPayment.payment_method)}
                  </div>
                </div>

                {/* Amount Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Amount Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Amount:</span>
                      <span className="text-lg font-bold text-gray-900">
                        {parseInt(selectedPayment.amount).toLocaleString()} {selectedPayment.currency}
                      </span>
                    </div>
                    {selectedPayment.refund_amount > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Refund Amount:</span>
                          <span className="text-sm font-medium text-purple-600">
                            {parseInt(selectedPayment.refund_amount).toLocaleString()} {selectedPayment.currency}
                          </span>
                        </div>
                        {selectedPayment.refund_reason && (
                          <div className="pt-2 border-t border-gray-200">
                            <span className="text-sm text-gray-600">Refund Reason:</span>
                            <p className="text-sm text-gray-900 mt-1">{selectedPayment.refund_reason}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Guest Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Guest Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Name:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedPayment.guest_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Email:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedPayment.guest_email}</span>
                    </div>
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Transaction Details</h3>
                  <div className="space-y-2">
                    {selectedPayment.transaction_reference && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Transaction Ref:</span>
                        <span className="text-sm font-mono text-gray-900">{selectedPayment.transaction_reference}</span>
                      </div>
                    )}
                    {selectedPayment.stripe_payment_intent_id && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Stripe Payment Intent:</span>
                        <span className="text-sm font-mono text-gray-900 break-all">{selectedPayment.stripe_payment_intent_id}</span>
                      </div>
                    )}
                    {selectedPayment.stripe_charge_id && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Stripe Charge ID:</span>
                        <span className="text-sm font-mono text-gray-900 break-all">{selectedPayment.stripe_charge_id}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Timestamps</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Created:</span>
                      <span className="text-xs text-gray-900">{formatDateTime(selectedPayment.created_at)}</span>
                    </div>
                    {selectedPayment.paid_at && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Paid:</span>
                        <span className="text-xs text-gray-900">{formatDateTime(selectedPayment.paid_at)}</span>
                      </div>
                    )}
                    {selectedPayment.refunded_at && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-600">Refunded:</span>
                        <span className="text-xs text-gray-900">{formatDateTime(selectedPayment.refunded_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {selectedPayment.error_message && (
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <h3 className="text-sm font-medium text-red-700 mb-2">Error Message</h3>
                    <p className="text-sm text-red-900">{selectedPayment.error_message}</p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={closeDetailModal}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Process Refund</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Refund Amount ({selectedPayment.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={refundData.refund_amount}
                    onChange={(e) => setRefundData({ ...refundData, refund_amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter refund amount"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Original amount: {parseInt(selectedPayment.amount).toLocaleString()} {selectedPayment.currency}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Refund Reason *
                  </label>
                  <textarea
                    value={refundData.refund_reason}
                    onChange={(e) => setRefundData({ ...refundData, refund_reason: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows="3"
                    placeholder="Explain why this refund is being processed..."
                    required
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> This will process a refund through Stripe and cancel the associated booking. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex space-x-4 mt-6">
                <button
                  onClick={closeRefundModal}
                  className="flex-1 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={processRefund}
                  className="flex-1 px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  Process Refund
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
