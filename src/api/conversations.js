import api from './client';
import { withMock } from './mock';
import * as mock from '../mocks/data';

/** GET /conversations?channel= → Conversation[] */
export const list = (params) =>
  withMock(() => api.get('/conversations', { params }), () => mock.conversations.filter((c) => !params?.channel || c.channel === params.channel));

/** GET /conversations/:id/messages → Message[] */
export const messages = (id) => withMock(() => api.get(`/conversations/${id}/messages`), mock.messages[id] || []);

/** POST /conversations/:id/messages { body } → Message (also broadcast as `message:new`). */
export const send = (id, body) =>
  withMock(() => api.post(`/conversations/${id}/messages`, { body }), () => ({
    id: Date.now(),
    conversationId: id,
    fromStaff: true,
    sender: 'FAY AI Concierge',
    body,
    createdAt: new Date().toISOString(),
  }));
