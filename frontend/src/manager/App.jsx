import { Box, CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { settingsApi } from './api';
import Layout, { LAST_PAGE_KEY } from './components/Layout';
import { useAuth } from './context/AuthContext';
import { SIDE, href, isPageId } from './data/pages';
import AICommand from './pages/AICommand';
import Assets from './pages/Assets';
import Analytics from './pages/Analytics';
import Communications from './pages/Communications';
import Content from './pages/Content';
import Dining from './pages/Dining';
import Enquiries from './pages/Enquiries';
import Events from './pages/Events';
import Experiences from './pages/Experiences';
import Guest360 from './pages/Guest360';
import GuestJourney from './pages/GuestJourney';
import Housekeeping from './pages/Housekeeping';
import Lockers from './pages/Lockers';
import Quality from './pages/Quality';
import Visitors from './pages/Visitors';
import Maintenance from './pages/Maintenance';
import Reservations from './pages/Reservations';
import Residences from './pages/Residences';
import ServiceRequests from './pages/ServiceRequests';
import Settings from './pages/Settings';
import Transportation from './pages/Transportation';
import Wellness from './pages/Wellness';
import { setCurrency } from './pages/guest360/format';

const VIEWS = {
  guest360: Guest360,
  journey: GuestJourney,
  comms: Communications,
  enquiries: Enquiries,
  requests: ServiceRequests,
  reservations: Reservations,
  residences: Residences,
  housekeeping: Housekeeping,
  maintenance: Maintenance,
  assets: Assets,
  wellness: Wellness,
  dining: Dining,
  transport: Transportation,
  lockers: Lockers,
  visitors: Visitors,
  experiences: Experiences,
  events: Events,
  content: Content,
  analytics: Analytics,
  quality: Quality,
  ai: AICommand,
  settings: Settings,
};

function lastPage() {
  try {
    const p = localStorage.getItem(LAST_PAGE_KEY) ?? undefined;
    return isPageId(p) ? p : 'guest360';
  } catch {
    return 'guest360';
  }
}

/** Dashboard routes, relative to /manager (the site's ProtectedRoute has already checked the role). */
export default function App() {
  const { ready, user } = useAuth();
  // Amounts are shown in the property's currency (Settings → Property).
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    if (!user) return;
    settingsApi
      .getProperty()
      .then((p) => setCurrency(p.currency))
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, [user]);
  if (!ready || (user && !settingsLoaded)) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={href(lastPage())} replace />} />
        {SIDE.map((id) => {
          const View = VIEWS[id];
          return <Route key={id} path={id} element={<View />} />;
        })}
      </Route>
      <Route path="*" element={<Navigate to={href(lastPage())} replace />} />
    </Routes>
  );
}
