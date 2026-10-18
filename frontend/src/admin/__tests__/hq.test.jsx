import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminApp from '../AdminApp';
import { hqApi } from '../api';
import { canOpenHq, homeFor } from '../access';
import { endViewAs, startViewAs, viewAsSession } from '../viewAs';

jest.mock('../api', () => ({
  hqApi: {
    me: jest.fn(),
    properties: jest.fn(),
    approvals: jest.fn(),
    overview: jest.fn(),
    roles: jest.fn(),
    updateRole: jest.fn(),
  },
}));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ logout: jest.fn() }) }));

const ALL = ['overview', 'finance', 'approvals', 'staff', 'roles', 'audit', 'properties', 'hr', 'website'];
const can = (areas) => Object.fromEntries(ALL.map((a) => [a, { view: areas.includes(a), manage: areas.includes(a), approve: areas.includes(a) }]));
const meFor = (role, areas, legacy = false) => ({ user: { id: 1, name: 'Ada Boss', role, roleName: role }, areas, can: can(areas), legacy, viewAs: false });

const OVERVIEW = {
  today: '2026-10-18',
  stays: { units: 13, arrivals: 2, departures: 1, inHouse: 9, occupancy: 69 },
  revenue: { today: 57000, mtd: 1380000, mtdChange: 12.5, streams: { stays: 1215000, dining: 165000, wellness: 0, experiences: 0, other: 0 }, trend: [{ day: '2026-10-17', total: 1000, stays: 1000 }, { day: '2026-10-18', total: 57000, stays: 45000 }] },
  approvals: { pending: 2, leave: 1, other: 1 },
  mobileMoney: { count: 1, amount: 90000 },
  operations: { openRequests: 3, urgentRequests: 1, maintenanceAlerts: 0 },
  staff: { total: 10, onLeaveToday: 0, byDepartment: [{ department: 'Housekeeping', count: 2 }] },
  alerts: [{ level: 'warning', icon: 'phone_iphone', text: '1 mobile money payment awaiting confirmation', to: 'finance' }],
  recentActivity: [],
};

function renderHq(path = '/admin') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  hqApi.properties.mockResolvedValue([{ id: 1, code: 'FWR', name: 'Faysha Wellness Residence', status: 'active', units: 13, staff: 10 }]);
  hqApi.approvals.mockResolvedValue([{ id: '1' }, { id: 'leave-2' }]);
  hqApi.overview.mockResolvedValue(OVERVIEW);
});

describe('who can open HQ', () => {
  it('follows the role permissions', () => {
    expect(canOpenHq({ role: 'superadmin' })).toBe(true);
    expect(canOpenHq({ role: 'hr_manager', permissions: { hr: { view: true } } })).toBe(true);
    expect(canOpenHq({ role: 'content_manager', permissions: { pages: { view: true } } })).toBe(true);
    expect(canOpenHq({ role: 'manager', permissions: { reservations: { view: true } } })).toBe(false);
    expect(homeFor({ role: 'manager' })).toBe('/manager');
    expect(homeFor({ role: 'staff', permissions: { operations: { view: true } } })).toBe(null);
  });
});

describe('Faysha HQ', () => {
  it('gives the super administrator the overview and every section', async () => {
    hqApi.me.mockResolvedValue(meFor('superadmin', ALL, true));
    renderHq();
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(await screen.findByText('1 mobile money payment awaiting confirmation')).toBeInTheDocument();
    const nav = screen.getByRole('complementary', { name: 'HQ navigation' });
    ['Finance', 'Approvals', 'Roles & permissions', 'Residences', 'Audit log'].forEach((label) => expect(within(nav).getByText(label)).toBeInTheDocument());
    expect(within(nav).getByLabelText('2 waiting')).toBeInTheDocument();
  });

  it('shows an HR manager only HR', async () => {
    hqApi.me.mockResolvedValue(meFor('hr_manager', ['hr']));
    renderHq('/admin/finance');
    const nav = await screen.findByRole('complementary', { name: 'HQ navigation' });
    expect(within(nav).getByText('HR')).toBeInTheDocument();
    ['Overview', 'Finance', 'Approvals', 'Residences'].forEach((label) => expect(within(nav).queryByText(label)).not.toBeInTheDocument());
    expect(await screen.findByRole('heading', { level: 1, name: 'Human resources' })).toBeInTheDocument();
    expect(hqApi.overview).not.toHaveBeenCalled();
  }, 20000);

  it('saves exactly the permissions ticked on a role', async () => {
    const user = userEvent.setup();
    hqApi.me.mockResolvedValue(meFor('superadmin', ALL, true));
    hqApi.roles.mockResolvedValue([
      { id: 1, name: 'superadmin', displayName: 'Super Administrator', permissions: {}, system: true, members: 1, locked: true },
      { id: 9, name: 'finance_director', displayName: 'Finance Director', description: 'Money', permissions: { overview: { view: true } }, system: false, members: 0 },
    ]);
    hqApi.updateRole.mockResolvedValue({ ok: true });
    renderHq('/admin/roles');
    const save = await screen.findByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    await user.click(screen.getByLabelText('Approvals: approve'));
    expect(screen.getByLabelText('Approvals: view')).toBeChecked();
    await user.click(save);
    expect(hqApi.updateRole).toHaveBeenCalledWith(9, {
      permissions: { overview: { view: true }, approvals: { approve: true, view: true } },
    });
  });
});

describe('view as', () => {
  const assign = jest.fn();
  beforeAll(() => {
    delete window.location;
    window.location = { assign };
  });

  it('keeps the super administrator session aside and restores it', () => {
    localStorage.setItem('authToken', 'boss-token');
    localStorage.setItem('adminUser', JSON.stringify({ id: 1, role: 'superadmin' }));
    startViewAs({ token: 'imp-token', user: { id: 3, name: 'Nadia', role: 'manager' }, expiresAt: '2099-01-01T00:00:00Z' });
    expect(localStorage.getItem('authToken')).toBe('imp-token');
    expect(viewAsSession().as.name).toBe('Nadia');
    expect(assign).toHaveBeenLastCalledWith('/manager');
    endViewAs();
    expect(localStorage.getItem('authToken')).toBe('boss-token');
    expect(viewAsSession()).toBe(null);
    expect(assign).toHaveBeenLastCalledWith('/admin/staff');
  });
});
