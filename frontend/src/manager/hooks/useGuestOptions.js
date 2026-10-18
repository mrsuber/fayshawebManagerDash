import { guestsApi } from '../api';
import useApi from './useApi';

/**
 * Guests for a FormDialog select: [[id, "Name · Residence"], …], in-house and arriving guests first.
 * Also returns `byId` for looking up the residence etc. after a pick.
 */
const ORDER = { 'In House': 0, Arriving: 1, Upcoming: 2, 'Checked Out': 3 };

/** In-house and arriving guests first, then by name. */
export const sortGuests = (list) => [...(list || [])].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || a.name.localeCompare(b.name));

export default function useGuestOptions() {
  const { data } = useApi(() => guestsApi.list(), [], null);
  const guests = sortGuests(data);
  return {
    options: guests.map((g) => [g.id, `${g.name} · ${g.residence} (${g.status})`]),
    byId: Object.fromEntries(guests.map((g) => [g.id, g])),
    inHouse: guests.filter((g) => g.status === 'In House'),
    /** Who to show when no guest is picked yet: the first in-house guest, else the next arrival… */
    firstId: guests[0]?.id ?? null,
    loaded: data !== null,
  };
}
