import { useSearchParams } from 'react-router-dom';
import { Tabs, Toolbar } from '../components/kit';
import Bookings from './wellness/Bookings';
import Catalogue from './wellness/Catalogue';
import WellnessToday from './wellness/Today';

/**
 * Wellness & Spa.
 *   Today      the places and experiences (with the photos set in HQ), today's schedule and what is coming
 *   Bookings   requests to confirm, check-in by the guest's code, every booking
 *   Catalogue  the experiences the app offers (editable)
 */
export default function Wellness() {
  const [params, setParams] = useSearchParams();
  const view = ['catalogue', 'bookings'].includes(params.get('view')) ? params.get('view') : 'today';
  const openTab = (v) => setParams(v === 'today' ? {} : { view: v });
  return (
    <div className="stack">
      <Toolbar>
        <Tabs value={view} onChange={openTab} options={[['today', 'Today'], ['bookings', 'Bookings'], ['catalogue', 'Catalogue']]} />
      </Toolbar>
      {view === 'catalogue' ? <Catalogue /> : view === 'bookings' ? <Bookings /> : <WellnessToday openTab={openTab} />}
    </div>
  );
}
