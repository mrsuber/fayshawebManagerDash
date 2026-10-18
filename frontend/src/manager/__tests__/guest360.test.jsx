import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { guestsApi, serviceRequestsApi } from '../api';
import Guest360 from '../pages/Guest360';
import { renderWithProviders } from '../test-utils';

const card = (title) => screen.getByText(title, { selector: '.card-title' }).closest('.card');

test('loads the guest profile with live data', async () => {
  renderWithProviders(<Guest360 />, { route: '/guest360?guest=1' });
  expect(await screen.findByText('Abba Abdouraman', { selector: '.serif' })).toBeInTheDocument();
  expect(await screen.findByText('Active Requests (3)')).toBeInTheDocument();
  expect(screen.getByText('All Guests (20)')).toBeInTheDocument();
});

test('creates a service request that appears on the card and in the API', async () => {
  renderWithProviders(<Guest360 />, { route: '/guest360?guest=1' });
  await userEvent.click((await screen.findAllByRole('button', { name: /Create Request/ }))[0]);
  await userEvent.type(screen.getByRole('textbox', { name: /^Request/ }), 'Extra pillows');
  await userEvent.click(screen.getByRole('button', { name: 'Create Request' }));
  expect(await screen.findByText('Active Requests (4)')).toBeInTheDocument();
  const all = await serviceRequestsApi.list({ guestId: 1 });
  expect(all.find((r) => r.title === 'Extra pillows')).toMatchObject({ title: 'Extra pillows', department: 'Housekeeping', location: 'Serenity 1', status: 'New' });
});

test('messages the guest and logs it on the timeline', async () => {
  renderWithProviders(<Guest360 />, { route: '/guest360?guest=1' });
  await userEvent.click((await screen.findAllByRole('button', { name: /Message Guest/ }))[0]);
  await userEvent.type(screen.getByRole('textbox', { name: /^Message/ }), 'Your yacht is confirmed.');
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Message sent via whatsapp')).toBeInTheDocument();
  const { messages } = await guestsApi.conversation(1);
  expect(messages[messages.length - 1].body).toBe('Your yacht is confirmed.');
});

test('filters the All Guests card and switches the profile', async () => {
  renderWithProviders(<Guest360 />, { route: '/guest360?guest=1' });
  const guests = await waitFor(() => card('All Guests (20)'));
  await userEvent.click(within(guests).getByText(/^Checked Out/));
  expect(within(guests).queryByText('Sophie Laurent')).not.toBeInTheDocument();
  await userEvent.type(within(guests).getByRole('textbox', { name: 'Search guests' }), 'fatima');
  await userEvent.click(within(guests).getByText('Fatima Al Mansoori'));
  expect(await screen.findByText('Fatima Al Mansoori', { selector: '.serif' })).toBeInTheDocument();
});

test('View All opens a filterable pop-up with every request', async () => {
  renderWithProviders(<Guest360 />, { route: '/guest360?guest=1' });
  const requests = await waitFor(() => card('Active Requests (3)'));
  await userEvent.click(within(requests).getByRole('button', { name: 'View All ›' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Late checkout')).toBeInTheDocument();
  await userEvent.click(within(dialog).getByText('Scheduled', { selector: '.chip' }));
  expect(within(dialog).queryByText('Late checkout')).not.toBeInTheDocument();
  expect(within(dialog).getByText('Airport transfer (departure)')).toBeInTheDocument();
});

test('books a wellness session from Quick Actions', async () => {
  renderWithProviders(<Guest360 />, { route: '/guest360?guest=1' });
  await userEvent.click(await screen.findByRole('button', { name: /Book Wellness/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Book' }));
  await waitFor(async () => expect((await guestsApi.bookings(1)).length).toBe(6));
  expect(await screen.findByText('Booked – FAY Thermal Recovery')).toBeInTheDocument();
});

test('checks the guest out from More Actions', async () => {
  renderWithProviders(<Guest360 />, { route: '/guest360?guest=1' });
  await userEvent.click(await screen.findByRole('button', { name: /More Actions/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: /Check Out/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Check Out' }));
  await waitFor(async () => expect((await guestsApi.get(1)).status).toBe('Checked Out'));
  expect(await screen.findByText('Last Stay')).toBeInTheDocument();
});
