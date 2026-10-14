import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import i18n from '../i18n';
import { renderWithProviders } from '../test-utils';

afterEach(() => act(() => i18n.changeLanguage('en')));

test('signs in the demo user in mock mode and renders the requested page', async () => {
  renderWithProviders(<App />, { route: '/guest360' });
  expect(await screen.findByRole('heading', { level: 1, name: 'Guest 360' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /Service Requests/ }).length).toBeGreaterThan(0);
});

test('navigates from the sidebar', async () => {
  renderWithProviders(<App />, { route: '/guest360' });
  await userEvent.click(await screen.findByRole('link', { name: /Housekeeping/ }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Housekeeping' })).toBeInTheDocument();
  expect(await screen.findByText('Villa Spectra 3')).toBeInTheDocument();
});

test('switches the interface to French', async () => {
  renderWithProviders(<App />, { route: '/settings' });
  await screen.findByRole('heading', { level: 1, name: 'Settings' });
  await userEvent.click(screen.getByRole('button', { name: 'Language' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Français' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Paramètres' })).toBeInTheDocument();
});

test('shows unread notifications from the API', async () => {
  renderWithProviders(<App />, { route: '/guest360' });
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
  expect(await screen.findByText('AC temperature escalated')).toBeInTheDocument();
});
