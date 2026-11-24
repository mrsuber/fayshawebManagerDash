/**
 * The clean after a departure. When a guest checks out, the system raises a Housekeeping request for the residence
 * ("Departure clean · A12", source 'system', the standard departure-clean time) and gives it to the least busy
 * housekeeper when auto-assign is on; otherwise the managers are told to assign it. As the housekeeper works, the
 * residence follows: started → Cleaning, done → Inspect (the inspection in FAY OS → Housekeeping then makes it Ready).
 */
const db = require('../config/database');
const assignment = require('./assignment');
const taskTimer = require('./taskTimer');
const { staffAlert } = require('./notify');

const KIND = 'departure_clean';
const io = (app) => app && app.get && app.get('io');

/** Raises the departure clean of a residence (once while one is open). Never throws: check-out must not fail on it. */
async function raise(app, { apartmentId, bookingId = null }) {
  try {
    if (!apartmentId) return null;
    const open = await db.query(
      `SELECT id FROM service_requests WHERE apartment_id = $1 AND metadata->>'kind' = $2 AND status NOT IN ('completed', 'cancelled') LIMIT 1`,
      [apartmentId, KIND],
    );
    if (open.rows[0]) return open.rows[0].id;
    const unit = (await db.query('SELECT unit_number FROM apartments WHERE id = $1', [apartmentId])).rows[0]?.unit_number || '';
    // Someone arriving in this residence today makes it urgent.
    const arrival = (await db.query(
      `SELECT guest_name FROM bookings WHERE apartment_id = $1 AND status IN ('confirmed', 'pending') AND check_in_date <= CURRENT_DATE AND check_out_date > CURRENT_DATE LIMIT 1`,
      [apartmentId],
    )).rows[0];
    const minutes = await taskTimer.minutesFor('departureClean');
    const { rows } = await db.query(
      `WITH n AS (SELECT nextval(pg_get_serial_sequence('service_requests', 'id')) AS id)
       INSERT INTO service_requests (id, request_number, booking_id, apartment_id, request_type, department, title, description, priority, location,
                                     source, time_allowed_minutes, metadata)
       SELECT n.id, '#' || n.id, $1, $2, 'housekeeping', 'Housekeeping', $3, $4, $5, $6, 'system', $7, $8 FROM n RETURNING id`,
      [
        bookingId,
        apartmentId,
        `Departure clean · ${unit}`,
        arrival ? `${arrival.guest_name} arrives today — the residence must be ready before check-in.` : 'The guest has left. Clean and prepare the residence for the next arrival.',
        arrival ? 'high' : 'normal',
        `Residence ${unit}`,
        minutes,
        JSON.stringify({ kind: KIND, bookingId }),
      ],
    );
    const id = rows[0].id;
    let assignee = null;
    if (await assignment.autoAssignOn()) {
      assignee = await assignment.suggest('Housekeeping');
      if (assignee) {
        await db.query('UPDATE service_requests SET assigned_to = $2, assigned_at = NOW() WHERE id = $1', [id, assignee.id]);
        await assignment.notifyAssignee(app, assignee.id, {
          title: 'Departure clean for you',
          body: `Residence ${unit} · ${minutes} minutes${arrival ? ' · guest arriving today' : ''}`,
          key: `request:${id}`,
        });
      }
    }
    if (!assignee) {
      await staffAlert(app, { title: `Departure clean to assign · ${unit}`, body: `The guest has left Residence ${unit}. Give the clean to a housekeeper (${minutes} minutes).`, link: `/requests?id=${id}`, level: 'action', category: 'housekeeping', dedupeKey: `departure-clean:${id}` });
    }
    const request = await require('../routes/manager/serviceRequests').one(id).catch(() => null);
    if (request) io(app)?.to('staff').emit('service-request:created', request);
    return id;
  } catch (e) {
    console.error('Departure clean failed:', e.message);
    return null;
  }
}

/** Moves the residence along with its departure clean: 'start' → Cleaning, 'done' → Inspect. */
async function progress(app, request, step, byName = null) {
  try {
    if (request?.metadata?.kind !== KIND || !request.apartment_id) return;
    const status = step === 'start' ? 'Cleaning' : step === 'done' ? 'Inspect' : null;
    if (!status) return;
    await db.query(
      `INSERT INTO residence_controls (apartment_id, housekeeping_status, housekeeping_note) VALUES ($1, $2, $3)
       ON CONFLICT (apartment_id) DO UPDATE SET housekeeping_status = $2, housekeeping_note = $3, updated_at = NOW()`,
      [request.apartment_id, status, status === 'Inspect' ? `Cleaned${byName ? ` by ${byName}` : ''} — to inspect` : 'Departure clean in progress'],
    );
    if (step === 'done' && byName) await db.query('UPDATE residence_controls SET cleaned_by = $2 WHERE apartment_id = $1', [request.apartment_id, byName]).catch(() => {});
    if (step !== 'start') await require('./notify').resolve(app, `departure-clean:${request.id}`);
    io(app)?.to('staff').emit('housekeeping:updated', { id: request.apartment_id, status });
  } catch (e) {
    console.error('Departure clean progress failed:', e.message);
  }
}

module.exports = { KIND, raise, progress };
