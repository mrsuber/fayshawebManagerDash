import { ScopedCssBaseline, ThemeProvider } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import '../manager/styles.css';
import { ToastProvider } from '../manager/context/ToastContext';
import theme from '../manager/theme';
import { hqApi } from './api';
import HqLayout from './components/HqLayout';
import LegacyHub from './components/LegacyHub';
import { HqContext, Loading } from './components/parts';
import './hq.css';
import { visibleNav } from './nav';
import Approvals from './pages/Approvals';
import Audit from './pages/Audit';
import Finance from './pages/Finance';
import Overview from './pages/Overview';
import Properties from './pages/Properties';
import Roles from './pages/Roles';
import Staff from './pages/Staff';

// v1 administrator screens, shown inside HQ until each is rebuilt.
const v1 = (load) => lazy(load);
const P = {
  Payments: v1(() => import('../pages/admin/Payments')),
  UserManagement: v1(() => import('../pages/admin/UserManagement')),
  GuestManagement: v1(() => import('../pages/admin/GuestManagement')),
  ApartmentCategories: v1(() => import('../pages/admin/ApartmentCategories')),
  Apartments: v1(() => import('../pages/admin/Apartments')),
  AvailabilityCalendar: v1(() => import('../pages/admin/AvailabilityCalendar')),
  DepositBoxManagement: v1(() => import('../pages/admin/DepositBoxManagement')),
  Bookings: v1(() => import('../pages/admin/Bookings')),
  FeedbackManagement: v1(() => import('../pages/admin/FeedbackManagement')),
  PageManagement: v1(() => import('../pages/admin/PageManagement')),
  ChangePassword: v1(() => import('../pages/admin/ChangePassword')),
  Employees: v1(() => import('../pages/admin/hr/Employees')),
  Jobs: v1(() => import('../pages/admin/hr/Jobs')),
  Applications: v1(() => import('../pages/admin/hr/Applications')),
  Attendance: v1(() => import('../pages/admin/hr/Attendance')),
  Leave: v1(() => import('../pages/admin/hr/Leave')),
  WellnessMetrics: v1(() => import('../pages/admin/WellnessMetrics')),
  WellnessActivities: v1(() => import('../pages/admin/WellnessActivities')),
  WellnessZones: v1(() => import('../pages/admin/WellnessZones')),
  WellnessAvailability: v1(() => import('../pages/admin/WellnessAvailability')),
  WellnessBookings: v1(() => import('../pages/admin/WellnessBookings')),
  WellnessConcierge: v1(() => import('../pages/admin/WellnessConcierge')),
};

const HUBS = {
  hr: [
    { id: 'employees', label: 'Employees', component: P.Employees },
    { id: 'recruitment', label: 'Recruitment', component: P.Jobs },
    { id: 'applications', label: 'Applications', component: P.Applications },
    { id: 'attendance', label: 'Attendance', component: P.Attendance },
    { id: 'leave', label: 'Leave', component: P.Leave },
  ],
  guests: [
    { id: 'profiles', label: 'Guest profiles', component: P.GuestManagement },
    { id: 'accounts', label: 'All accounts', component: P.UserManagement },
  ],
  residences: [
    { id: 'categories', label: 'Categories', component: P.ApartmentCategories },
    { id: 'units', label: 'Units & photos', component: P.Apartments },
    { id: 'calendar', label: 'Availability', component: P.AvailabilityCalendar },
    { id: 'deposit-boxes', label: 'Deposit boxes', component: P.DepositBoxManagement },
  ],
  bookings: [{ id: 'all', label: 'Bookings', component: P.Bookings }],
  wellness: [
    { id: 'dashboard', label: 'Dashboard', component: P.WellnessMetrics },
    { id: 'activities', label: 'Activities', component: P.WellnessActivities },
    { id: 'zones', label: 'Zones', component: P.WellnessZones },
    { id: 'availability', label: 'Availability', component: P.WellnessAvailability },
    { id: 'bookings', label: 'Bookings', component: P.WellnessBookings },
    { id: 'concierge', label: 'Concierge', component: P.WellnessConcierge },
  ],
  feedback: [{ id: 'all', label: 'Feedback', component: P.FeedbackManagement }],
  website: [{ id: 'pages', label: 'Pages', component: P.PageManagement }],
};

// v1 addresses → their place in HQ (bookmarks and links in old emails).
const OLD = {
  users: 'guests/accounts', pages: 'website', categories: 'residences/categories', apartments: 'residences/units',
  calendar: 'residences/calendar', 'deposit-boxes': 'residences/deposit-boxes', payments: 'finance', 'hr/jobs': 'hr/recruitment',
};

function NoAccess({ message }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 460, gap: 14, padding: 28 }}>
        <span className="serif" style={{ fontSize: 30, fontWeight: 600 }}>HQ is not part of your role</span>
        <span className="sub" style={{ fontSize: 14, lineHeight: 1.6 }}>{message || 'Ask a super administrator to grant your role an HQ area in Roles & permissions.'}</span>
        <Link to="/">Back to the website</Link>
      </div>
    </div>
  );
}

const PROPERTY_KEY = 'fayhq.property';

/** Faysha HQ, mounted by the site at /admin/* (lazy-loaded). The site's ProtectedRoute has checked sign-in. */
export default function AdminApp() {
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [properties, setProperties] = useState([]);
  const [property, setPropertyState] = useState(() => {
    try {
      const v = localStorage.getItem(PROPERTY_KEY);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  });
  const [counts, setCounts] = useState({ approvals: 0 });

  useEffect(() => {
    document.body.classList.add('fayos', 'fayhq');
    return () => document.body.classList.remove('fayos', 'fayhq');
  }, []);

  const refreshProperties = useCallback(
    () =>
      hqApi.properties().then((list) => {
        setProperties(list);
        // With one property there is nothing to choose: it is always in focus.
        setPropertyState((cur) => (list.length === 1 ? list[0].id : list.some((p) => p.id === cur) ? cur : null));
      }),
    [],
  );

  const refreshCounts = useCallback(() => {
    hqApi
      .approvals('pending')
      .then((list) => setCounts((c) => ({ ...c, approvals: list.length })))
      .catch(() => {});
  }, []);

  useEffect(() => {
    hqApi
      .me()
      .then((m) => {
        setMe(m);
        refreshProperties().catch(() => {});
        if (m.areas.includes('approvals')) refreshCounts();
      })
      .catch(setError);
  }, [refreshProperties, refreshCounts]);

  const setProperty = useCallback((id) => {
    setPropertyState(id);
    try {
      if (id) localStorage.setItem(PROPERTY_KEY, String(id));
      else localStorage.removeItem(PROPERTY_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo(
    () => ({
      me,
      can: (area, action = 'view') => Boolean(me?.can?.[area]?.[action]),
      property,
      properties,
      setProperty,
      refreshProperties,
      counts,
      refreshCounts,
    }),
    [me, property, properties, setProperty, refreshProperties, counts, refreshCounts],
  );

  let body;
  if (error) body = <NoAccess message={error.status === 403 ? undefined : error.message} />;
  else if (!me) body = <Loading label="Opening HQ" />;
  else {
    const first = visibleNav(me)[0]?.items[0];
    const allow = (area) => me.areas.includes(area);
    body = (
      <HqContext.Provider value={value}>
        <Routes>
          <Route element={<HqLayout />}>
            <Route index element={allow('overview') ? <Overview /> : <Navigate to={`/admin/${first?.to || ''}`} replace />} />
            {allow('finance') && <Route path="finance" element={<Finance ledger={me.legacy ? P.Payments : null} />} />}
            {allow('approvals') && <Route path="approvals" element={<Approvals />} />}
            {allow('staff') && <Route path="staff" element={<Staff />} />}
            {allow('roles') && <Route path="roles" element={<Roles />} />}
            {allow('audit') && <Route path="audit" element={<Audit />} />}
            {allow('properties') && <Route path="properties" element={<Properties />} />}
            {allow('hr') && <Route path="hr/:tab?" element={<LegacyHub base="hr" tabs={HUBS.hr} />} />}
            {allow('website') && <Route path="website/:tab?" element={<LegacyHub base="website" tabs={HUBS.website} />} />}
            {me.legacy &&
              ['guests', 'residences', 'bookings', 'wellness', 'feedback'].map((k) => (
                <Route key={k} path={`${k}/:tab?`} element={<LegacyHub base={k} tabs={HUBS[k]} />} />
              ))}
            <Route
              path="change-password"
              element={
                <Suspense fallback={<Loading />}>
                  <div className="hq-legacy">
                    <P.ChangePassword />
                  </div>
                </Suspense>
              }
            />
            {Object.entries(OLD).map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={`/admin/${to}`} replace />} />
            ))}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </HqContext.Provider>
    );
  }

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <ScopedCssBaseline sx={{ bgcolor: 'transparent', minHeight: '100vh' }}>
          <ToastProvider>{body}</ToastProvider>
        </ScopedCssBaseline>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
