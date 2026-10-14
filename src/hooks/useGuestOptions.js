import { guestsApi } from '../api';
import useApi from './useApi';

/**
 * Guests for a FormDialog select: [[id, "Name · Residence"], …], in-house and arriving guests first.
 * Also returns `byId` for looking up the residence etc. after a pick.
 */
export default function useGuestOptions() {
  const { data } = useApi(() => guestsApi.list(), [], []);
  const order = { 'In House': 0, Arriving: 1, Upcoming: 2, 'Checked Out': 3 };
  const guests = [...(data || [])].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  return {
    options: guests.map((g) => [g.id, `${g.name} · ${g.residence} (${g.status})`]),
    byId: Object.fromEntries(guests.map((g) => [g.id, g])),
    inHouse: guests.filter((g) => g.status === 'In House'),
  };
}
