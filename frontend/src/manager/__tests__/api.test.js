import api, { setToken } from '../api/client';
import config from '../config';
import { href, pageOf } from '../data/pages';

test('attaches the stored JWT as a bearer token', async () => {
  setToken('abc.def.ghi');
  let sent;
  const res = await api.get('/ping', {
    adapter: async (config) => {
      sent = config;
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  expect(res.data).toEqual({ ok: true });
  expect(sent.headers.Authorization).toBe('Bearer abc.def.ghi');
  expect(sent.baseURL).toBe(config.apiUrl);
  expect(config.apiUrl).toMatch(/\/api\/manager$/);
  setToken(null);
});

test('surfaces the Express error message', async () => {
  const err = await api
    .get('/fail', {
      adapter: async (config) => {
        const e = new Error('Request failed with status code 400');
        e.response = { status: 400, data: { message: 'Residence not found' }, config };
        throw e;
      },
    })
    .catch((e) => e);
  expect(err.message).toBe('Residence not found');
});

test('maps dashboard paths to the /manager mount point', () => {
  expect(href('/guest360?guest=3')).toBe('/manager/guest360?guest=3');
  expect(href('comms')).toBe('/manager/comms');
  expect(pageOf('/manager/reservations')).toBe('reservations');
});
