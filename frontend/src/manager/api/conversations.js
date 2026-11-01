import api from './client';
import { withMock } from './mock';
import { getDb, mutate, nextId } from '../mocks/db';

/** GET /conversations?channel= → Conversation[] newest first */
export const list = (params) =>
  withMock(
    () => api.get('/conversations', { params }),
    () =>
      getDb()
        .conversations.filter((c) => !params?.channel || c.channel === params.channel)
        .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)),
  );

/** GET /conversations/:id/messages → Message[] oldest first */
export const messages = (id) => withMock(() => api.get(`/conversations/${id}/messages`), () => getDb().messages.filter((m) => m.conversationId === id));

/** POST /attachments (multipart) → { url, name, type, mimeType, size } — then send it with send(id, body, attachment). */
export const upload = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/attachments', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }).then((r) => r.data.attachment);
};

/** POST /conversations/:id/messages { body, attachment? } → Message (also broadcast as `message:new`). */
export const send = (id, body, attachment) =>
  withMock(
    () => api.post(`/conversations/${id}/messages`, { body, attachment }),
    () =>
      mutate((d) => {
        const message = { id: nextId(d.messages), conversationId: id, fromStaff: true, sender: 'FAY AI Concierge', body, createdAt: new Date().toISOString() };
        d.messages.push(message);
        Object.assign(d.conversations.find((c) => c.id === id), { lastMessage: body, lastAt: message.createdAt, lastAtLabel: undefined });
        return message;
      }),
  );
