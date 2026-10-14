import { Box, CircularProgress } from '@mui/material';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout, { LAST_PAGE_KEY } from './components/Layout';
import { useAuth } from './context/AuthContext';
import { SIDE, isPageId } from './data/pages';
import AICommand from './pages/AICommand';
import Analytics from './pages/Analytics';
import Communications from './pages/Communications';
import Dining from './pages/Dining';
import Experiences from './pages/Experiences';
import Guest360 from './pages/Guest360';
import GuestJourney from './pages/GuestJourney';
import Housekeeping from './pages/Housekeeping';
import Login from './pages/Login';
import Maintenance from './pages/Maintenance';
import Reservations from './pages/Reservations';
import Residences from './pages/Residences';
import ServiceRequests from './pages/ServiceRequests';
import Settings from './pages/Settings';
import Transportation from './pages/Transportation';
import Wellness from './pages/Wellness';

const VIEWS = {
  guest360: Guest360,
  journey: GuestJourney,
  comms: Communications,
  requests: ServiceRequests,
  reservations: Reservations,
  residences: Residences,
  housekeeping: Housekeeping,
  maintenance: Maintenance,
  wellness: Wellness,
  dining: Dining,
  transport: Transportation,
  experiences: Experiences,
  analytics: Analytics,
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

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to={`/${lastPage()}`} replace />} />
        {SIDE.map((id) => {
          const View = VIEWS[id];
          return <Route key={id} path={id} element={<View />} />;
        })}
      </Route>
      <Route path="*" element={<Navigate to={`/${lastPage()}`} replace />} />
    </Routes>
  );
}
