import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { collectionsApi, guestsApi, reservationsApi, serviceRequestsApi } from '../api';
import AICommand from '../pages/AICommand';
import Dining from '../pages/Dining';
import Experiences from '../pages/Experiences';
import GuestJourney from '../pages/GuestJourney';
import Housekeeping from '../pages/Housekeeping';
import Maintenance from '../pages/Maintenance';
import Reservations from '../pages/Reservations';
import ServiceRequests from '../pages/ServiceRequests';
import Settings from '../pages/Settings';
import Transportation from '../pages/Transportation';
import Wellness from '../pages/Wellness';
import { renderWithProviders } from '../test-utils';

const card = (title) => screen.getByText(title, { selector: '.card-title' }).closest('.card');
const viewAll = async (title) => {
  const c = await waitFor(() => card(title));
  await userEvent.click(within(c).getAllByRole('button').find((b) => /View All|View Full|View Menu|Manage/.test(b.textContent)));
  return screen.findByRole('dialog');
};

test('Guest Journey follows the guest and toggles automations', async () => {
  renderWithProviders(<GuestJourney />, { route: '/journey?guest=1' });
  expect(await screen.findByText('Abba Abdouraman', { selector: '.serif' })).toBeInTheDocument();
  const autos = await waitFor(() => card('Automations'));
  await userEvent.click(within(autos).getByRole('switch', { name: 'Birthday surprise' }));
  await waitFor(async () => expect((await collectionsApi.list('automations')).find((a) => a.title === 'Birthday surprise').enabled).toBe(true));
  const dialog = await viewAll('Journey Timeline');
  expect(within(dialog).getByText('Reservation confirmed – Serenity 1')).toBeInTheDocument();
});

test('Service Requests creates a request for a chosen guest', async () => {
  renderWithProviders(<ServiceRequests />);
  await screen.findAllByText('#1385');
  await userEvent.click(screen.getByRole('button', { name: /New Request/ }));
  await userEvent.type(screen.getByRole('textbox', { name: /^Request/ }), 'Spare charger');
  await userEvent.click(screen.getByRole('button', { name: 'Create Request' }));
  expect((await screen.findAllByText('Spare charger')).length).toBeGreaterThan(0);
  expect((await serviceRequestsApi.list()).some((r) => r.title === 'Spare charger')).toBe(true);
});

test('Reservations rejects an overlapping stay and lists bookings in View All', async () => {
  const existing = (await reservationsApi.list()).find((r) => r.status === 'Confirmed');
  await expect(reservationsApi.create({ guestName: 'X', residence: existing.residence, checkIn: existing.checkIn, checkOut: existing.checkOut })).rejects.toThrow(/already booked/);
  renderWithProviders(<Reservations />);
  await screen.findAllByText(existing.residence);
  const dialog = await viewAll('Recent Bookings');
  expect((await within(dialog).findAllByText(existing.guestName)).length).toBeGreaterThan(0);
  await userEvent.click(within(dialog).getByText('Cancelled', { selector: '.chip' }));
  expect(within(dialog).getByText('Oliver Grant')).toBeInTheDocument();
});

test('Housekeeping advances a task and restocks linen', async () => {
  renderWithProviders(<Housekeeping />);
  const tasks = await waitFor(() => card("Today's Tasks (9)"));
  const row = within(tasks).getByText('Daily service').closest('.row-line');
  await userEvent.click(within(row).getByRole('button', { name: 'Scheduled' }));
  expect(within(row).getByRole('button', { name: 'In Progress' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Restock Toiletry kits' }));
  await waitFor(async () => expect((await collectionsApi.list('linenStock')).find((x) => x.item === 'Toiletry kits').level).toBe(100));
});

test('Maintenance turns a device alert into a work order', async () => {
  renderWithProviders(<Maintenance />);
  const alerts = await waitFor(() => card('Smart Home Device Alerts'));
  await userEvent.click((await within(alerts).findAllByRole('button', { name: 'Create WO' }))[0]);
  await userEvent.click(await screen.findByRole('button', { name: 'Create Work Order' }));
  await waitFor(async () => expect((await collectionsApi.list('workOrders')).some((o) => o.number === 'WO-413')).toBe(true));
  await waitFor(async () => expect((await collectionsApi.list('maintenanceAlerts'))[0].status).toBe('Converted'));
});

test('Wellness refuses a clashing booking', async () => {
  renderWithProviders(<Wellness />);
  await screen.findByText("Today's Schedule (8)");
  await userEvent.click(screen.getByRole('button', { name: /New Booking/ }));
  const start = screen.getByLabelText(/^Start/);
  await userEvent.clear(start);
  await userEvent.type(start, '09:30');
  await userEvent.click(screen.getByRole('button', { name: 'Book' }));
  expect(await screen.findByText(/Treatment Room 1 is booked 09:00–10:00/)).toBeInTheDocument();
});

test('Dining seats a reservation and the floor plan follows', async () => {
  renderWithProviders(<Dining />);
  const resv = await waitFor(() => card("Today's Reservations (8)"));
  const row = within(resv).getByText('Michael Chen').closest('.row-line');
  await userEvent.click(within(row).getByRole('button', { name: 'Confirmed' }));
  await waitFor(async () => expect((await collectionsApi.list('diningReservations')).find((r) => r.guestName === 'Michael Chen').status).toBe('Seated'));
  expect(await screen.findByText('M. Chen')).toBeInTheDocument();
});

test('Transportation books a transfer', async () => {
  renderWithProviders(<Transportation />);
  await screen.findByText('Transfers (7)');
  await userEvent.click(screen.getByRole('button', { name: /Book Transfer/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Book' }));
  await waitFor(async () => expect((await collectionsApi.list('transfers')).length).toBe(9));
});

test('Experiences books from the catalogue and enforces capacity', async () => {
  renderWithProviders(<Experiences />);
  const tile = (await screen.findByText('Private Golf Experience', { selector: '.card-title' })).closest('.card');
  await userEvent.click(within(tile).getByRole('button', { name: 'Book' }));
  const pax = screen.getByRole('spinbutton', { name: /Participants/ });
  await userEvent.clear(pax);
  await userEvent.type(pax, '9');
  await userEvent.click(screen.getByRole('button', { name: 'Book' }));
  expect(await screen.findByText(/takes up to 4 guests/)).toBeInTheDocument();
});

test('AI Command resolves an alert and adds a priority from an insight', async () => {
  renderWithProviders(<AICommand />);
  const alerts = await waitFor(() => card('Live Alerts & Priorities (5)'));
  await userEvent.click((await within(alerts).findAllByRole('button', { name: 'Resolve' }))[0]);
  expect(await screen.findByText('Live Alerts & Priorities (4)')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Implement' }));
  await waitFor(async () => expect((await collectionsApi.list('aiPriorities')).some((p) => p.title === 'Extend Pool Club hours this weekend')).toBe(true));
});

test('Settings invites a team member', async () => {
  renderWithProviders(<Settings />, { route: '/settings?section=team' });
  await screen.findByText('Team & Roles (8)');
  await userEvent.click(screen.getByRole('button', { name: /Invite/ }));
  await userEvent.type(screen.getByRole('textbox', { name: /Full name/ }), 'Aya N.');
  await userEvent.type(screen.getByRole('textbox', { name: /Email/ }), 'aya@faysha.com');
  await userEvent.click(screen.getByRole('button', { name: 'Send Invitation' }));
  expect(await screen.findByText('Team & Roles (9)')).toBeInTheDocument();
});

test('a message sent from Communications reaches the guest timeline', async () => {
  const before = (await guestsApi.timeline(1)).length;
  await guestsApi.sendMessage(1, { channel: 'email', body: 'Hello' });
  expect((await guestsApi.timeline(1)).length).toBe(before + 1);
});
