import { screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AICommand from '../pages/AICommand';
import Communications from '../pages/Communications';
import Housekeeping from '../pages/Housekeeping';
import ServiceRequests from '../pages/ServiceRequests';
import { renderWithProviders } from '../test-utils';

test('Communications sends a message to the selected guest', async () => {
  renderWithProviders(<Communications />);
  const input = await screen.findByPlaceholderText('Type a message to Abba Abdouraman…');
  await userEvent.type(input, 'Your locker code is 4821{enter}');
  expect((await screen.findAllByText('Your locker code is 4821')).length).toBeGreaterThan(0);
  expect(input).toHaveValue('');
});

test('Communications filters conversations by channel', async () => {
  renderWithProviders(<Communications />);
  await screen.findByText('Sophie Laurent');
  await userEvent.click(screen.getByText('Email'));
  await waitForElementToBeRemoved(() => screen.queryByText('Michael Chen'));
  expect(screen.getAllByText('Sophie Laurent').length).toBeGreaterThan(0);
  expect(screen.getByText('David Kim')).toBeInTheDocument();
});

test('Service Requests marks the selected request completed', async () => {
  renderWithProviders(<ServiceRequests />);
  const row = (await screen.findAllByText('#1385'))[0].closest('.hov-row');
  expect(within(row).getByText('In Progress')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Mark as Completed'));
  expect(within(row).getByText('Completed')).toBeInTheDocument();
});

test('Housekeeping advances a vacant residence but not an occupied one', async () => {
  renderWithProviders(<Housekeeping />);
  const dirty = (await screen.findByText('Riviera 2')).parentElement;
  await userEvent.click(dirty);
  expect(within(dirty).getByText('Cleaning')).toBeInTheDocument();
  const occupied = screen.getByText('Serenity 1').parentElement;
  await userEvent.click(occupied);
  expect(within(occupied).getByText('Occupied')).toBeInTheDocument();
});

test('AI Command answers a suggested prompt', async () => {
  renderWithProviders(<AICommand />);
  await userEvent.click(screen.getByText('Optimize housekeeping schedule'));
  expect(await screen.findByText(/frees Maya R\. for Serenity 2 arrival prep/)).toBeInTheDocument();
});
