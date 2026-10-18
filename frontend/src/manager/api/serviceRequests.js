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

/** POST /service-requests { guestId, title, department, priority, location, notes } → ServiceRequest (also emits `service-request:created`). */
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
