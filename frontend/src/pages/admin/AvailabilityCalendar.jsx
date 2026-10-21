import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import axios from 'axios';
import { API_URL } from '../../site/api';

const localizer = momentLocalizer(moment);

const AvailabilityCalendar = () => {
  const [bookings, setBookings] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    fetchApartments();
    fetchBookings();
  }, [selectedApartment]);

  const fetchApartments = async () => {
    try {
      const response = await axios.get(`${API_URL}/apartments`);
      if (response.data.success) {
        setApartments(response.data.apartments);
      }
    } catch (error) {
      console.error('Error fetching apartments:', error);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const startDate = moment().subtract(1, 'month').format('YYYY-MM-DD');
      const endDate = moment().add(3, 'months').format('YYYY-MM-DD');

      const params = {
        start_date: startDate,
        end_date: endDate
      };

      if (selectedApartment !== 'all') {
        params.apartment_id = selectedApartment;
      }

      const response = await axios.get(`${API_URL}/bookings/calendar`, { params });

      if (response.data.success) {
        const events = response.data.bookings.map(booking => ({
          id: booking.id,
          title: `${booking.unit_number} - ${booking.guest_name}`,
          start: moment(booking.check_in_date).toDate(),
          end: moment(booking.check_out_date).toDate(),
          resource: booking,
          allDay: true
        }));
        setBookings(events);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (event) => {
    setSelectedBooking(event.resource);
    setShowBookingModal(true);
  };

  const eventStyleGetter = (event) => {
    const booking = event.resource;
    let backgroundColor = '#3174ad';

    switch (booking.status) {
      case 'confirmed':
        backgroundColor = '#10b981'; // green
        break;
      case 'pending':
        backgroundColor = '#f59e0b'; // orange
        break;
      case 'checked_in':
        backgroundColor = '#8b5cf6'; // purple
        break;
      case 'cancelled':
        backgroundColor = '#ef4444'; // red
        break;
      default:
        backgroundColor = '#6b7280'; // gray
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  const formatPrice = (price) => {
    return parseInt(price).toLocaleString();
  };

  const formatDate = (dateString) => {
    return moment(dateString).format('MMM DD, YYYY');
  };

  const getDaysDifference = (start, end) => {
    return moment(end).diff(moment(start), 'days');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Availability Calendar</h1>
          <p className="mt-2 text-gray-600">View and manage apartment bookings</p>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Apartment
              </label>
              <select
                value={selectedApartment}
                onChange={(e) => setSelectedApartment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Apartments</option>
                {apartments.map(apt => (
                  <option key={apt.id} value={apt.id}>
                    {apt.unit_number} - {apt.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Type
              </label>
              <select
                value={view}
                onChange={(e) => setView(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="month">Month</option>
                <option value="week">Week</option>
                <option value="agenda">Agenda</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Legend
              </label>
              <div className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-xs text-gray-600">Confirmed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded"></div>
                  <span className="text-xs text-gray-600">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded"></div>
                  <span className="text-xs text-gray-600">Checked In</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <Calendar
              localizer={localizer}
              events={bookings}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 700 }}
              onSelectEvent={handleEventClick}
              eventPropGetter={eventStyleGetter}
              view={view}
              onView={setView}
              views={['month', 'week', 'agenda']}
              popup
            />
          )}
        </div>

        {/* Booking Details Modal */}
        {showBookingModal && selectedBooking && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowBookingModal(false)}
            ></div>

            <div className="flex min-h-screen items-center justify-center p-4">
              <div
                className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 transform transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Booking Details</h2>
                  <p className="text-gray-500 mt-1">{selectedBooking.booking_number}</p>
                </div>

                {/* Status Badge */}
                <div className="mb-6">
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                    selectedBooking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    selectedBooking.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                    selectedBooking.status === 'checked_in' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-500">Guest Name</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedBooking.guest_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedBooking.guest_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Apartment</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedBooking.unit_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedBooking.category_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Check-In</p>
                    <p className="text-lg font-semibold text-gray-900">{formatDate(selectedBooking.check_in_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Check-Out</p>
                    <p className="text-lg font-semibold text-gray-900">{formatDate(selectedBooking.check_out_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Guests</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedBooking.number_of_guests}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Price</p>
                    <p className="text-lg font-semibold text-primary-600">{formatPrice(selectedBooking.final_price)} XAF</p>
                  </div>
                </div>

                {/* Location Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-2">Location</p>
                  <p className="text-gray-900">
                    <span className="font-semibold">{selectedBooking.building}</span>, Floor {selectedBooking.floor}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailabilityCalendar;
