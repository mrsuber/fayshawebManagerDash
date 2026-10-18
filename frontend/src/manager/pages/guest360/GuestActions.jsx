import { useState } from 'react';
import { guestsApi, serviceRequestsApi } from '../../api';
import FormDialog from '../../components/FormDialog';
import PaymentDialog from '../../components/PaymentDialog';
import { useToast } from '../../context/ToastContext';
import { BOOKING_TYPES, CHANNELS, DEPARTMENTS, currencyCode, localInput, toLocalInput } from './format';

const TAG_SUGGESTIONS = ['Wellness & Recovery', 'Fine Dining', 'Outdoor Experiences', 'Business', 'Family', 'Spa', 'Golf', 'Water Activities', 'Celebration', 'Fitness', 'Cultural', 'Pool'];
const DURATIONS = [
  [30, '30 min'],
  [45, '45 min'],
  [60, '1 hour'],
  [90, '1 h 30'],
  [120, '2 hours'],
  [180, '3 hours'],
  [240, '4 hours'],
];

/**
 * Every Guest 360 action (message, request, booking, preferences, tags, note, payments, check-in/out)
 * as `open(kind, preset)`, plus the dialogs to render. `onChanged` reloads the page data afterwards.
 */
export default function useGuestActions(guest, onChanged) {
  const toast = useToast();
  const [dialog, setDialog] = useState(null);
  const open = (kind, preset = {}) => setDialog({ kind, preset });
  const close = () => setDialog(null);
  const is = (kind) => dialog?.kind === kind;
  const preset = dialog?.preset || {};
  const done = (message) => (result) => {
    toast(message);
    onChanged();
    return result;
  };

  const run = (promise, message) =>
    promise.then(done(message)).catch((e) => {
      toast(e.message, 'error');
    });

  const actions = {
    open,
    toggleVip: () => run(guestsApi.update(guest.id, { vip: !guest.vip }), guest.vip ? 'VIP status removed' : 'Marked as VIP'),
    checkIn: () => run(guestsApi.checkIn(guest.id), `${guest.name} checked in`),
  };

  const bookingType = BOOKING_TYPES[preset.type] || BOOKING_TYPES.wellness;
  // A preset title (e.g. from a recommendation) is offered first even if it isn't in the type's catalogue.
  const booking = { ...bookingType, options: preset.title && !bookingType.options.includes(preset.title) ? [preset.title, ...bookingType.options] : bookingType.options };
  const resched = preset.booking;

  const dialogs = guest && (
    <>
      <FormDialog
        open={is('message')}
        title={`Message ${guest.name}`}
        subtitle={`${guest.contact.phone} · ${guest.contact.email}`}
        submitLabel="Send"
        fields={[
          { name: 'channel', label: 'Channel', type: 'select', options: CHANNELS },
          { name: 'body', label: 'Message', type: 'textarea', rows: 4, required: true, autoFocus: true },
        ]}
        initial={{ channel: preset.channel || 'whatsapp', body: preset.body || '' }}
        onSubmit={(v) => guestsApi.sendMessage(guest.id, v).then(done('Message sent'))}
        onClose={close}
      />
      <FormDialog
        open={is('request')}
        title="Create Service Request"
        subtitle={`${guest.name} · ${guest.residence}`}
        submitLabel="Create Request"
        fields={[
          { name: 'title', label: 'Request', required: true, autoFocus: true, helperText: 'e.g. Extra towels, AC check, Late checkout' },
          { name: 'department', label: 'Department', type: 'select', options: DEPARTMENTS },
          { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Normal', 'Low'] },
          { name: 'location', label: 'Location', required: true },
          { name: 'notes', label: 'Notes for the team', type: 'textarea', rows: 2 },
        ]}
        initial={{ department: preset.department || 'Housekeeping', priority: 'Normal', location: guest.residence, title: preset.title || '' }}
        onSubmit={(v) => serviceRequestsApi.create({ ...v, guestId: guest.id }).then(done(`Request created – ${v.title}`))}
        onClose={close}
      />
      <FormDialog
        open={is('booking')}
        title={`Book ${booking.label}`}
        subtitle={`${guest.name} · ${guest.residence}`}
        submitLabel="Book"
        fields={[
          { name: 'title', label: booking.label, type: 'select', options: booking.options, required: true },
          { name: 'startsAt', label: 'Starts', type: 'datetime', required: true },
          { name: 'duration', label: 'Duration', type: 'select', options: DURATIONS },
          { name: 'guests', label: 'Guests', type: 'number', required: true },
          { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
        ]}
        initial={{ title: preset.title || booking.options[0], startsAt: localInput(1, preset.type === 'dining' ? '20:00' : '10:00'), duration: 60, guests: guest.adults || 1 }}
        onSubmit={({ startsAt, duration, guests, ...v }) => {
          const start = new Date(startsAt);
          return guestsApi
            .createBooking(guest.id, { ...v, type: preset.type || 'wellness', guests: Number(guests), startsAt: start.toISOString(), endsAt: new Date(start.getTime() + duration * 60000).toISOString() })
            .then(done(`${v.title} booked`));
        }}
        onClose={close}
      />
      <FormDialog
        open={is('reschedule')}
        title={`Modify – ${resched?.title || ''}`}
        subtitle={guest.name}
        submitLabel="Save Changes"
        fields={[
          { name: 'startsAt', label: 'Starts', type: 'datetime', required: true },
          { name: 'guests', label: 'Guests', type: 'number', required: true },
          { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
        ]}
        initial={resched ? { startsAt: toLocalInput(resched.startsAt), guests: resched.guests, notes: resched.notes || '' } : {}}
        onSubmit={({ startsAt, guests, notes }) => {
          const start = new Date(startsAt);
          const length = new Date(resched.endsAt) - new Date(resched.startsAt);
          return guestsApi
            .updateBooking(guest.id, resched.id, { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + length).toISOString(), guests: Number(guests), notes })
            .then(done(`${resched.title} updated`));
        }}
        onClose={close}
      />
      <FormDialog
        open={is('preferences')}
        title="Edit Preferences"
        subtitle={guest.name}
        fields={guest.preferences.map((p) => ({ name: p.key, label: p.title, type: 'textarea', rows: 1 }))}
        initial={Object.fromEntries(guest.preferences.map((p) => [p.key, p.detail]))}
        onSubmit={(v) => guestsApi.update(guest.id, { preferences: guest.preferences.map((p) => ({ ...p, detail: v[p.key] })) }).then(done('Preferences saved'))}
        onClose={close}
      />
      <FormDialog
        open={is('tags')}
        title="Guest Tags"
        subtitle="Type a tag and press Enter to add it"
        fields={[{ name: 'tags', label: 'Tags', type: 'tags', options: TAG_SUGGESTIONS }]}
        initial={{ tags: guest.tags }}
        onSubmit={(v) => guestsApi.update(guest.id, { tags: v.tags }).then(done('Tags updated'))}
        onClose={close}
      />
      <FormDialog
        open={is('note')}
        title="Add Staff Note"
        subtitle={guest.name}
        submitLabel="Add Note"
        fields={[{ name: 'body', label: 'Note', type: 'textarea', rows: 4, required: true, autoFocus: true }]}
        onSubmit={(v) => guestsApi.addNote(guest.id, v.body).then(done('Note added'))}
        onClose={close}
      />
      <FormDialog
        open={is('recordPayment')}
        title="Record Payment"
        subtitle={`${guest.name} · balance ${preset.balanceLabel || ''}`}
        submitLabel="Record Payment"
        fields={[
          { name: 'amount', label: `Amount (${currencyCode()})`, type: 'number', required: true },
          { name: 'method', label: 'Method', type: 'select', options: ['Card terminal', 'Cash', 'Bank transfer', 'Room charge transfer'] },
        ]}
        initial={{ amount: preset.balance > 0 ? preset.balance : '', method: 'Card terminal' }}
        onSubmit={(v) => {
          if (!(Number(v.amount) > 0)) return Promise.reject(new Error('Enter an amount greater than 0'));
          return guestsApi.recordPayment(guest.id, v).then(done('Payment recorded'));
        }}
        onClose={close}
      />
      <FormDialog
        open={is('checkOut')}
        title={`Check out ${guest.name}?`}
        subtitle={`${guest.residence} · the digital key will be deactivated and housekeeping notified.`}
        submitLabel="Check Out"
        fields={[]}
        onSubmit={() => guestsApi.checkOut(guest.id).then(done(`${guest.name} checked out`))}
        onClose={close}
      />
      <PaymentDialog
        reservation={is('cardPayment') ? { guestId: guest.id, guestName: guest.name, residence: guest.residence, balanceDue: preset.balance, currency: preset.currency } : null}
        onClose={() => {
          close();
          onChanged();
        }}
      />
    </>
  );

  return { actions, dialogs };
}
