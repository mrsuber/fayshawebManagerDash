import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { addDays, nightsBetween, stayFromParams } from '../format';
import { withAvailability } from '../pages/Residences';

// .env.test sets REACT_APP_USE_MOCKS=true, so the site runs on src/site/mocks.js.

function renderAt(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('format helpers', () => {
  it('counts nights across month ends', () => {
    expect(nightsBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('repairs a stay whose check-out is not after check-in', () => {
    const stay = stayFromParams(new URLSearchParams('checkIn=2099-05-10&checkOut=2099-05-10&guests=40'));
    expect(stay).toEqual({ checkIn: '2099-05-10', checkOut: '2099-05-11', guests: 12 });
  });
});

describe('withAvailability', () => {
  const residences = [{ id: 1, maxGuests: 2, price: 100, image: null }];
  const units = [
    { id: 10, categoryId: 1, available: true, maxGuests: 2, price: 120 },
    { id: 11, categoryId: 1, available: true, maxGuests: 2, price: 90 },
    { id: 12, categoryId: 1, available: false, maxGuests: 2, price: 50 },
  ];

  it('offers the cheapest free unit first', () => {
    const [r] = withAvailability(residences, units, 2);
    expect(r.freeUnits.map((u) => u.id)).toEqual([11, 10]);
    expect(r.fromPrice).toBe(90);
  });

  it('has nothing free when the party is too large', () => {
    const [r] = withAvailability(residences, units, 3);
    expect(r.fits).toBe(false);
    expect(r.freeUnits).toHaveLength(0);
  });
});

describe('public site', () => {
  it('renders the home page with the residences from the API', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: /one destination, endless serenity/i })).toBeInTheDocument();
    expect(await screen.findByText('Executive Suite', { selector: 'h3' })).toBeInTheDocument();
  });

  it('will not take payment until both terms are accepted', async () => {
    const user = userEvent.setup();
    renderAt('/book?unit=4&checkIn=2099-01-10&checkOut=2099-01-12&guests=2');

    await user.type(await screen.findByLabelText(/full name/i), 'Amara Nkeng');
    await user.type(screen.getByLabelText(/^email/i), 'amara@example.com');
    await user.type(screen.getByLabelText(/phone/i), '+237 650 000 000');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('heading', { name: 'Terms of stay' })).toBeInTheDocument();
    const next = screen.getByRole('button', { name: /continue/i });
    expect(next).toBeDisabled();

    const [terms, rules] = screen.getAllByRole('checkbox');
    await user.click(terms);
    expect(next).toBeDisabled();
    await user.click(rules);
    expect(next).toBeEnabled();

    await user.click(next);
    expect(await screen.findByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'MTN Mobile Money' }));
    await user.click(screen.getByRole('button', { name: /request payment/i }));
    expect(await screen.findByRole('heading', { name: /your booking is reserved/i })).toBeInTheDocument();
  });

  it('sends old v1 addresses to their new pages', async () => {
    renderAt('/terms-of-service');
    await waitFor(() => expect(window.location.pathname).toBe('/terms'));
    expect(within(document.querySelector('main')).getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
  });
});
