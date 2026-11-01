import axios from 'axios';
import * as mock from './mocks';

/**
 * Public website API (the Express backend under /api).
 * Same base URL rules as the rest of the frontend: REACT_APP_API_URL, else /api in production and the
 * local dev API on localhost. With REACT_APP_USE_MOCKS=true (development only) the site runs on sample
 * data so it can be worked on without a backend.
 */
const env = process.env;

export const API_URL = (
  env.REACT_APP_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '/api' : 'http://localhost:5001/api')
).replace(/\/$/, '');

export const USE_MOCKS = env.NODE_ENV !== 'production' && env.REACT_APP_USE_MOCKS === 'true';

/** Upload paths from the API (/uploads/...) are served by the backend origin. */
export function mediaUrl(url) {
  if (!url) return null;
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:') || url.startsWith('/images/')) return url;
  const origin = /^https?:\/\//.test(API_URL) ? API_URL.replace(/\/api$/, '') : '';
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

const http = axios.create({ baseURL: API_URL, timeout: 20000 });

const message = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || fallback || err.message;

async function call(promise, fallback) {
  try {
    const res = await promise;
    if (res.data && res.data.success === false) throw new Error(res.data.message || fallback);
    return res.data;
  } catch (err) {
    throw new Error(message(err, fallback));
  }
}

const parseList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
    }
  }
  return [];
};

/** API category row → the shape the site renders. */
export function toResidence(c) {
  return {
    id: c.id,
    slug: c.name,
    name: c.display_name || c.name,
    description: c.description || '',
    price: Number(c.base_price) || 0,
    maxGuests: Number(c.max_guests) || 1,
    bedrooms: Number(c.bedrooms) || 0,
    bathrooms: Number(c.bathrooms) || 0,
    size: c.size_sqm ? Number(c.size_sqm) : null,
    features: parseList(c.features),
    amenities: parseList(c.amenities),
    image: mediaUrl(c.primary_image || c.representative_image),
    units: Number(c.apartment_count) || 0,
  };
}

function toUnit(a) {
  return {
    id: a.id,
    unit: a.unit_number,
    floor: a.floor,
    building: a.building,
    categoryId: a.category_id,
    price: Number(a.price_per_night ?? a.effective_price) || 0,
    maxGuests: Number(a.max_guests) || 1,
    available: a.is_available !== false,
    image: mediaUrl(a.primary_image),
    panorama: mediaUrl(a.panorama_360_url),
  };
}

export async function getResidences() {
  if (USE_MOCKS) return mock.categories.map(toResidence);
  const data = await call(http.get('/apartments/categories', { params: { active_only: 'true' } }), 'Could not load residences');
  return (data.categories || []).filter((c) => c.is_active !== false).map(toResidence);
}

/** Every unit with its availability for the dates: [{ id, unit, categoryId, price, available, ... }]. */
export async function getAvailability(checkIn, checkOut) {
  if (USE_MOCKS) return mock.availability(checkIn, checkOut).map(toUnit);
  const data = await call(
    http.get('/bookings/availability', { params: { start_date: checkIn, end_date: checkOut } }),
    'Could not check availability',
  );
  return (data.availability || []).map(toUnit);
}

/** Category media (photos, 360° panoramas) via one of its units: GET /apartments/:id returns unit + category media. */
export async function getUnitMedia(unitId) {
  if (USE_MOCKS || !unitId) return [];
  const data = await call(http.get(`/apartments/${unitId}`), 'Could not load photos');
  return (data.apartment?.media || []).map((m) => ({
    id: m.id,
    type: m.media_type,
    url: mediaUrl(m.file_url),
    thumb: mediaUrl(m.thumbnail_url || m.file_url),
    title: m.title,
    primary: m.is_primary,
  }));
}

export async function getUnit(id) {
  if (USE_MOCKS) {
    const a = mock.availability().find((u) => String(u.id) === String(id));
    return a ? toUnit(a) : null;
  }
  const data = await call(http.get(`/apartments/${id}`), 'Residence not found');
  const a = data.apartment;
  return a ? { ...toUnit(a), categoryId: a.category_id } : null;
}

/** Creates a pending booking (held until payment). Returns the API booking row. */
export async function createBooking(payload) {
  if (USE_MOCKS) return mock.createBooking(payload);
  const avail = await call(
    http.post('/bookings/check-availability', {
      apartment_id: payload.apartment_id,
      check_in_date: payload.check_in_date,
      check_out_date: payload.check_out_date,
    }),
    'Could not check availability',
  );
  if (!avail.available) throw new Error('That residence was just booked for these dates. Please choose another.');
  const data = await call(http.post('/bookings', payload), 'Could not create the booking');
  return data.booking;
}

/** Starts a card payment, in `currency` when the guest chose one (converted at the recorded rate) else XAF. */
export async function createCardPayment(bookingId, currency) {
  if (USE_MOCKS) return { client_secret: null, payment: { stripe_payment_intent_id: 'pi_mock' } };
  return call(http.post('/payments/create-intent', { booking_id: bookingId, currency }), 'Could not start the card payment');
}

export async function confirmBooking(bookingId, body) {
  if (USE_MOCKS) return { success: true };
  return call(http.post(`/bookings/${bookingId}/confirm`, body), 'Could not confirm the booking');
}

export async function requestMobileMoney(body) {
  if (USE_MOCKS) return { success: true };
  return call(http.post('/payments/mobile-money', body), 'Could not request the mobile money payment');
}

export async function getPageContent(pageId, language) {
  if (USE_MOCKS) return {};
  try {
    const res = await http.get(`/pages/${pageId}/${language}`);
    return res.data?.content || {};
  } catch {
    return {};
  }
}

export async function getTestimonials(limit = 3) {
  if (USE_MOCKS) return [];
  try {
    const res = await http.get('/feedback/testimonials', { params: { limit } });
    return res.data?.testimonials || [];
  } catch {
    return [];
  }
}

export async function getJobs() {
  if (USE_MOCKS) return mock.jobs;
  const data = await call(http.get('/jobs', { params: { active_only: 'true' } }), 'Could not load open positions');
  return data.jobs || [];
}

export async function applyForJob(jobId, formData) {
  if (USE_MOCKS) return { success: true };
  return call(http.post(`/jobs/${jobId}/apply`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Could not send your application');
}

export async function submitFeedback(formData) {
  if (USE_MOCKS) return { success: true };
  return call(http.post('/feedback/submit', formData, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Could not send your feedback');
}

export async function sendContact(body) {
  if (USE_MOCKS) return { success: true };
  return call(http.post('/contact', body), 'Could not send your message');
}

export async function forgotPassword(email) {
  if (USE_MOCKS) return { success: true };
  return call(http.post('/auth/forgot-password', { email }), 'Could not send the reset link');
}

export async function resetPassword(token, newPassword, confirmPassword) {
  if (USE_MOCKS) return { success: true };
  return call(http.post('/auth/reset-password', { token, newPassword, confirmPassword }), 'Could not reset your password');
}

/** Published legal document (FAY OS → Content): { slug, title, version, effectiveDate, body (Markdown) }. */
export async function getLegal(slug) {
  if (USE_MOCKS) throw new Error('mocks');
  return call(http.get(`/content/legal/${slug}`), 'Could not load the document');
}

/** Standard check-in / check-out times (FAY OS → Settings) and the currencies on offer. */
export async function getStayPolicy() {
  if (USE_MOCKS) return { checkIn: '14:00', checkOut: '11:00', currency: 'XAF' };
  return call(http.get('/content/stay-policy'), 'Could not load the stay policy');
}

/** Published estate places (Explore, 360° tour). */
export async function getPlaces() {
  if (USE_MOCKS) return [];
  const data = await call(http.get('/content/places'), 'Could not load the estate');
  return (Array.isArray(data) ? data : []).map((p) => ({ ...p, cover: mediaUrl(p.cover), panorama: mediaUrl(p.panorama) }));
}

/** Published stories (the journal), optionally one category. */
export async function getStories(category) {
  if (USE_MOCKS) return [];
  const data = await call(http.get('/content/stories', { params: category ? { category } : {} }), 'Could not load stories');
  return (Array.isArray(data) ? data : []).map((s) => ({ ...s, cover: mediaUrl(s.cover) }));
}

/** One published story with its gallery and three more to read. */
export async function getStory(slug) {
  const s = await call(http.get(`/content/stories/${encodeURIComponent(slug)}`), 'Story not found');
  return { ...s, cover: mediaUrl(s.cover), gallery: (s.gallery || []).map(mediaUrl), more: (s.more || []).map((m) => ({ ...m, cover: mediaUrl(m.cover) })) };
}

/** An event request (wedding, celebration, corporate…): POST /events → { reference }. */
export async function sendEventRequest(body) {
  if (USE_MOCKS) return { reference: 'EVT-DEMO-0001' };
  return call(http.post('/events', body), 'Could not send your request');
}

/** A proposal sent to the client (private link). */
export async function getEventQuote(token) {
  return call(http.get(`/events/quote/${encodeURIComponent(token)}`), 'This proposal link is not valid');
}

export async function respondToEventQuote(token, body) {
  return call(http.post(`/events/quote/${encodeURIComponent(token)}/respond`, body), 'Could not record your answer');
}

/** A visitor pass shared by a resident (public link). */
export async function getVisitorPass(token) {
  return call(http.get(`/visit/${encodeURIComponent(token)}`), 'This visitor pass is not valid');
}
export const visitorQrUrl = (token) => `${API_URL}/visit/${encodeURIComponent(token)}/qr.png`;
