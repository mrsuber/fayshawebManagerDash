import api from './client';
import { withMock } from './mock';

/** GET /team-performance?days=30 → { days, people: [summary] } — every active team member, with their record. */
export const list = (days = 30) => withMock(() => api.get('/team-performance', { params: { days } }), { days, people: [] });

/**
 * GET /team-performance/:id?days=30 → { days, person, period, allTime, stars, ratings, history, months, warnings, attendance }
 * (backend/routes/manager/teamPerformance.js).
 */
export const get = (id, days = 30) => withMock(() => api.get(`/team-performance/${id}`, { params: { days } }), () => {
  throw new Error('Team performance needs the live API');
});
