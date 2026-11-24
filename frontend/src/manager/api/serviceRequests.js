import api from './client';
import { withMock } from './mock';
import { addTimeline, getDb, mutate, nextId, notify } from '../mocks/db';

/** GET /service-requests?department=&guestId= → ServiceRequest[] newest first */
export const list = (params = {}) =>
  withMock(
    () => api.get('/service-requests', { params }),
    () =>
      getDb()
        .serviceRequests.filter((r) => !params.guestId || r.guestId === Number(params.guestId))
        .filter((r) => !params.department || r.department === params.department)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  );

/** GET /service-requests/performance?days=30 → { days, standards, people: [{ id, name, done, onTime, onTimeRate, avgMinutes, avgLateMinutes, open, lateNow, rating, ratings }] } */
export const performance = (days = 30) =>
  withMock(
    () => api.get('/service-requests/performance', { params: { days } }),
    () => {
      const done = getDb().serviceRequests.filter((r) => r.timer && r.timer.endedAt && r.assignedTo);
      const by = {};
      done.forEach((r) => {
        const p = (by[r.assignedTo.id] ||= { id: r.assignedTo.id, name: r.assignedTo.name, done: 0, onTime: 0, took: [], late: [], open: 0, lateNow: 0, rating: null, ratings: 0 });
        p.done += 1;
        if (r.timer.onTime) p.onTime += 1;
        else p.late.push(r.timer.lateMinutes);
        p.took.push(r.timer.takenMinutes);
      });
      const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
      return {
        days,
        standards: getDb().preferences.taskTimes,
        people: Object.values(by).map(({ took, late, ...p }) => ({ ...p, onTimeRate: Math.round((p.onTime / p.done) * 100), avgMinutes: avg(took), avgLateMinutes: avg(late) })),
      };
    },
  );

/**
 * POST /service-requests { guestId?, guestName?, title, department, priority, location, notes, minutes?, assignedTo? } → ServiceRequest
 * (also emits `service-request:created`). No guest: a task for the property. minutes: time allowed (else the department's
 * standard). assignedTo: a person, 'auto' or nothing.
 */
export const create = (data) =>
  withMock(
    () => api.post('/service-requests', data),
    () =>
      mutate((d) => {
        const g = d.guests.find((x) => x.id === Number(data.guestId));
        const id = nextId(d.serviceRequests);
        const req = {
          id,
          number: `#${id}`,
          createdAt: new Date().toISOString(),
          status: 'New',
          priority: 'Normal',
          notes: '',
          ...data,
          guestId: g ? g.id : null,
          guestName: g ? g.name : data.guestName,
          source: 'manager',
          minutes: Number(data.minutes) || d.preferences.taskTimes?.[data.department] || 30,
          assignedTo: null,
          timer: null,
        };
        d.serviceRequests.push(req);
        addTimeline(d, req.guestId, `Request created – ${req.title}`, 'Service Request');
        notify(d, `New ${req.department} request`, `${req.title} · ${req.guestName}`);
        return req;
      }),
  );

/** PATCH /service-requests/:id { status } → ServiceRequest (also emits `service-request:updated`). */
export const update = (id, changes) =>
  withMock(
    () => api.patch(`/service-requests/${id}`, changes),
    () =>
      mutate((d) => {
        const req = d.serviceRequests.find((r) => r.id === id);
        Object.assign(req, changes);
        if (changes.status) addTimeline(d, req.guestId, `${req.title} – ${changes.status}`, 'Service Request');
        return req;
      }),
  );
