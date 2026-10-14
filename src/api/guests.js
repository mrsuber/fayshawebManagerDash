import api from './client';
import { withMock } from './mock';
import { addTimeline, getDb, mutate, nextId, notify } from '../mocks/db';

const byGuest = (list, id) => list.filter((x) => x.guestId === Number(id));
const newestFirst = (key) => (a, b) => (a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : 0);
const find = (d, id) => {
  const g = d.guests.find((x) => x.id === Number(id));
  if (!g) throw Object.assign(new Error('Guest not found'), { status: 404 });
  return g;
};

function value(d, id) {
  const stays = byGuest(d.stays, id).filter((s) => s.status !== 'Upcoming');
  const rated = stays.filter((s) => s.satisfaction != null);
  return {
    revenue: stays.reduce((sum, s) => sum + s.amount, 0),
    stays: stays.length,
    satisfaction: rated.length ? Math.round((rated.reduce((sum, s) => sum + s.satisfaction, 0) / rated.length) * 10) / 10 : null,
  };
}

function summary(d, g) {
  const stays = byGuest(d.stays, g.id).filter((s) => s.status !== 'Upcoming');
  return {
    id: g.id,
    name: g.name,
    vip: g.vip,
    status: g.status,
    residence: g.residence,
    collection: g.collection,
    checkIn: g.checkIn,
    checkOut: g.checkOut,
    country: g.contact.country,
    totalStays: stays.length,
    lastStayAt: stays.map((s) => s.checkIn).sort().pop() || g.checkIn,
  };
}

/** GET /guests?status=&q= → GuestSummary[] (everyone who has stayed or is booked) */
export const list = (params = {}) =>
  withMock(
    () => api.get('/guests', { params }),
    () => {
      const d = getDb();
      const q = (params.q || '').toLowerCase();
      return d.guests
        .filter((g) => !params.status || (params.status === 'VIP' ? g.vip : g.status === params.status))
        .filter((g) => !q || `${g.name} ${g.residence} ${g.contact.country} ${g.contact.email}`.toLowerCase().includes(q))
        .map((g) => summary(d, g))
        .sort(newestFirst('lastStayAt'));
    },
  );

/** GET /guests/:id → Guest (profile, contact, current stay, preferences, services, insights, value) */
export const get = (id) => withMock(() => api.get(`/guests/${id}`), () => ({ ...find(getDb(), id), value: value(getDb(), id) }));

/** PATCH /guests/:id { tags?, preferences?, vip?, contact? } → Guest */
export const update = (id, changes) =>
  withMock(
    () => api.patch(`/guests/${id}`, changes),
    () =>
      mutate((d) => {
        const g = find(d, id);
        Object.assign(g, changes);
        if (changes.preferences) addTimeline(d, g.id, 'Preferences updated', 'Profile');
        return { ...g, value: value(d, id) };
      }),
  );

/** POST /guests/:id/check-in → Guest */
export const checkIn = (id) =>
  withMock(
    () => api.post(`/guests/${id}/check-in`),
    () =>
      mutate((d) => {
        const g = find(d, id);
        g.status = 'In House';
        g.flags = { ...g.flags, digitalKey: true };
        addTimeline(d, g.id, 'Checked in · digital key activated', 'Arrival');
        notify(d, 'Guest checked in', `${g.name} · ${g.residence}`);
        return { ...g, value: value(d, id) };
      }),
  );

/** POST /guests/:id/check-out → Guest */
export const checkOut = (id) =>
  withMock(
    () => api.post(`/guests/${id}/check-out`),
    () =>
      mutate((d) => {
        const g = find(d, id);
        g.status = 'Checked Out';
        g.flags = { ...g.flags, digitalKey: false };
        const stay = byGuest(d.stays, g.id).find((s) => s.status === 'Current');
        if (stay) stay.status = 'Completed';
        addTimeline(d, g.id, 'Checked out', 'Departure');
        notify(d, 'Guest checked out', `${g.name} · ${g.residence}`);
        return { ...g, value: value(d, id) };
      }),
  );

/** GET /guests/:id/timeline → TimelineEvent[] newest first */
export const timeline = (id) => withMock(() => api.get(`/guests/${id}/timeline`), () => byGuest(getDb().timeline, id).sort(newestFirst('at')));

/** GET /guests/:id/stays → Stay[] newest first */
export const stays = (id) => withMock(() => api.get(`/guests/${id}/stays`), () => byGuest(getDb().stays, id).sort(newestFirst('checkIn')));

/** GET /guests/:id/bookings → Booking[] by start time */
export const bookings = (id) =>
  withMock(
    () => api.get(`/guests/${id}/bookings`),
    () => byGuest(getDb().bookings, id).sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1)),
  );

const BOOKING_CATEGORY = { wellness: 'Wellness', dining: 'Dining', experience: 'Experience', transport: 'Transportation' };

/** POST /guests/:id/bookings { type, title, startsAt, endsAt, guests, notes } → Booking */
export const createBooking = (id, data) =>
  withMock(
    () => api.post(`/guests/${id}/bookings`, data),
    () =>
      mutate((d) => {
        const booking = { id: nextId(d.bookings), guestId: Number(id), status: 'Confirmed', notes: '', guests: 1, ...data };
        d.bookings.push(booking);
        addTimeline(d, booking.guestId, `Booked – ${booking.title}`, BOOKING_CATEGORY[booking.type] || 'Booking');
        return booking;
      }),
  );

/** PATCH /guests/:id/bookings/:bookingId { status } → Booking */
export const updateBooking = (id, bookingId, changes) =>
  withMock(
    () => api.patch(`/guests/${id}/bookings/${bookingId}`, changes),
    () =>
      mutate((d) => {
        const b = d.bookings.find((x) => x.id === bookingId);
        Object.assign(b, changes);
        if (changes.status) addTimeline(d, b.guestId, `${changes.status} – ${b.title}`, BOOKING_CATEGORY[b.type] || 'Booking');
        else if (changes.startsAt) addTimeline(d, b.guestId, `Rescheduled – ${b.title}`, BOOKING_CATEGORY[b.type] || 'Booking');
        return b;
      }),
  );

/** GET /guests/:id/notes → Note[] newest first */
export const notes = (id) => withMock(() => api.get(`/guests/${id}/notes`), () => byGuest(getDb().notes, id).sort(newestFirst('createdAt')));

/** POST /guests/:id/notes { body } → Note (author = signed-in user) */
export const addNote = (id, body) =>
  withMock(
    () => api.post(`/guests/${id}/notes`, { body }),
    () =>
      mutate((d) => {
        const note = { id: nextId(d.notes), guestId: Number(id), body, author: 'FAY Admin', createdAt: new Date().toISOString() };
        d.notes.push(note);
        addTimeline(d, note.guestId, 'Staff note added', 'Note');
        return note;
      }),
  );

/** GET /guests/:id/folio → { charges, payments, total, paid, balance, currency } */
export const folio = (id) =>
  withMock(
    () => api.get(`/guests/${id}/folio`),
    () => {
      const d = getDb();
      const charges = byGuest(d.charges, id).sort(newestFirst('date'));
      const payments = byGuest(d.payments, id).sort(newestFirst('date'));
      const total = charges.reduce((s, c) => s + c.amount, 0);
      const paid = payments.reduce((s, p) => s + p.amount, 0);
      return { charges, payments, total, paid, balance: total - paid, currency: 'usd' };
    },
  );

/** GET /guests/:id/conversation → { conversation, messages } (conversation is null until the first message) */
export const conversation = (id) =>
  withMock(
    () => api.get(`/guests/${id}/conversation`),
    () => {
      const d = getDb();
      const conv = d.conversations.find((c) => c.guestId === Number(id)) || null;
      return { conversation: conv, messages: conv ? d.messages.filter((m) => m.conversationId === conv.id) : [] };
    },
  );

/** POST /guests/:id/messages { channel, body } → Message. Creates the conversation if needed; also emits `message:new`. */
export const sendMessage = (id, { channel = 'whatsapp', body }) =>
  withMock(
    () => api.post(`/guests/${id}/messages`, { channel, body }),
    () =>
      mutate((d) => {
        const g = find(d, id);
        let conv = d.conversations.find((c) => c.guestId === g.id);
        if (!conv) {
          conv = { id: nextId(d.conversations), guestId: g.id, guestName: g.name, channel, stayStatus: g.status === 'Upcoming' ? 'Arriving' : g.status };
          d.conversations.push(conv);
        }
        const message = { id: nextId(d.messages), conversationId: conv.id, fromStaff: true, sender: 'FAY AI Concierge', body, channel, createdAt: new Date().toISOString() };
        d.messages.push(message);
        Object.assign(conv, { lastMessage: body, lastAt: message.createdAt, lastAtLabel: undefined, channel });
        addTimeline(d, g.id, `Message sent via ${channel === 'in_app' ? 'app' : channel}`, 'Communication');
        return message;
      }),
  );

/** POST /guests/:id/payments { amount, method } → Payment (cash/terminal payments recorded by staff; card payments go through Stripe). */
export const recordPayment = (id, { amount, method }) =>
  withMock(
    () => api.post(`/guests/${id}/payments`, { amount, method }),
    () =>
      mutate((d) => {
        const payment = { id: nextId(d.payments), guestId: Number(id), date: new Date().toISOString(), method, amount: Number(amount) };
        d.payments.push(payment);
        addTimeline(d, payment.guestId, `Payment received – $${payment.amount} (${method})`, 'Billing');
        return payment;
      }),
  );
