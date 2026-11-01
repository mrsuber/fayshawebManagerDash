import api from './client';
import { withMock } from './mock';

const upload = (path) => (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(path, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }).then((r) => r.data.url);
};

/** POST /content/images (multipart) → url. Covers, 360° panoramas and story images. */
export const uploadImage = upload('/content/images');

export const places = () => withMock(() => api.get('/content/places'), []);
export const createPlace = (data) => withMock(() => api.post('/content/places', data), null);
export const updatePlace = (id, data) => withMock(() => api.patch(`/content/places/${id}`, data), null);
export const deletePlace = (id) => withMock(() => api.delete(`/content/places/${id}`), { ok: true });
export const orderPlaces = (ids) => withMock(() => api.put('/content/places/order', { ids }), []);

export const legal = () => withMock(() => api.get('/content/legal'), []);
export const legalVersion = (slug, version) => withMock(() => api.get(`/content/legal/${slug}/versions/${version}`), null);
export const saveLegal = (slug, data) => withMock(() => api.put(`/content/legal/${slug}`, data), null);
export const publishLegal = (slug, data) => withMock(() => api.post(`/content/legal/${slug}/publish`, data), null);

export const stories = () => withMock(() => api.get('/content/stories'), []);
export const createStory = (data) => withMock(() => api.post('/content/stories', data), null);
export const updateStory = (id, data) => withMock(() => api.patch(`/content/stories/${id}`, data), null);
export const deleteStory = (id) => withMock(() => api.delete(`/content/stories/${id}`), { ok: true });
