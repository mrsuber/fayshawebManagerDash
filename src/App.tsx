import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { SIDE, isPageId, type PageId } from './data/pages';
import AICommand from './pages/AICommand';
import Analytics from './pages/Analytics';
import Communications from './pages/Communications';
import Dining from './pages/Dining';
import Experiences from './pages/Experiences';
import Guest360 from './pages/Guest360';
import GuestJourney from './pages/GuestJourney';
import Housekeeping from './pages/Housekeeping';
import Maintenance from './pages/Maintenance';
import Reservations from './pages/Reservations';
import Residences from './pages/Residences';
import ServiceRequests from './pages/ServiceRequests';
import Settings from './pages/Settings';
import Transportation from './pages/Transportation';
import Wellness from './pages/Wellness';

export const LAST_PAGE_KEY = 'fayos.page';

const VIEWS: Record<PageId, () => JSX.Element> = {
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

function lastPage(): PageId {
  try {
    const p = localStorage.getItem(LAST_PAGE_KEY) ?? undefined;
    return isPageId(p) ? p : 'guest360';
  } catch {
    return 'guest360';
  }
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
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
