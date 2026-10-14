import moment from 'moment';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

/** Collection → [background, text] colors for stay bars. */
export const COLLECTION_COLORS = {
  Serenity: ['#2f6fe8', '#fff'],
  'Villa Spectra': ['#e8c46a', '#1a1408'],
  'Allure Penthouse': ['#e05858', '#fff'],
  Riviera: ['#4fbf7a', '#0d1a12'],
  'Riviera 2': ['#7c4ddb', '#fff'],
  Blocked: ['#5c6270', '#fff'],
};

/** Reservation → react-big-calendar all-day event. checkOut is exclusive, so the bar ends the night before departure. */
export const toEvent = (r) => ({
  id: r.id,
  title: `${r.residence} · ${r.guestName}`,
  start: moment(r.checkIn).startOf('day').toDate(),
  end: moment(r.checkOut).startOf('day').toDate(),
  allDay: true,
  resource: r,
});

/**
 * Stays calendar (month/week/day). Controlled: the parent owns `view` and `date`
 * so it can refetch reservations when the visible range changes.
 */
export default function BookingCalendar({ reservations, view, onView, date, onNavigate, onSelect }) {
  return (
    // Stays are all-day events, so week/day views show only the all-day row (the hour grid is hidden in styles.css).
    <div className={`fay-calendar fay-calendar-${view}`} style={{ height: view === 'month' ? 560 : 'auto' }}>
      <Calendar
        localizer={localizer}
        events={reservations.map(toEvent)}
        view={view}
        onView={onView}
        views={['month', 'week', 'day']}
        date={date}
        onNavigate={onNavigate}
        toolbar={false}
        popup
        formats={{ dayFormat: 'ddd D' }}
        onSelectEvent={(e) => onSelect?.(e.resource)}
        eventPropGetter={(e) => {
          const [bg, fg] = COLLECTION_COLORS[e.resource.collection] || COLLECTION_COLORS.Blocked;
          return { style: { background: bg, color: fg, border: 0, borderRadius: 4, fontSize: 12, padding: '2px 8px' } };
        }}
      />
    </div>
  );
}
