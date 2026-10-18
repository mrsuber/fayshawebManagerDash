import { collectionsApi } from '../api';
import { useToast } from '../context/ToastContext';
import useApi from './useApi';

/**
 * A server-backed list: `items` plus create/update/remove that update the list optimistically
 * and toast on success or failure. `params` filters the list (sent as query params).
 */
export default function useCollection(name, params) {
  const toast = useToast();
  const key = JSON.stringify(params || {});
  const q = useApi(() => collectionsApi.list(name, params), [name, key], []);
  const items = q.data || [];

  const fail = (e) => {
    toast(e.message, 'error');
    throw e;
  };

  const create = (data, message) =>
    collectionsApi
      .create(name, data)
      .then((item) => {
        q.setData((list) => [item, ...(list || [])]);
        if (message) toast(message);
        return item;
      })
      .catch(fail);

  const update = (id, changes, message) => {
    const before = items.find((x) => x.id === id);
    q.setData((list) => list.map((x) => (x.id === id ? { ...x, ...changes } : x)));
    return collectionsApi
      .update(name, id, changes)
      .then((item) => {
        if (message) toast(message);
        return item;
      })
      .catch((e) => {
        q.setData((list) => list.map((x) => (x.id === id ? before : x)));
        return fail(e);
      });
  };

  const remove = (id, message) => {
    const before = items;
    q.setData((list) => list.filter((x) => x.id !== id));
    return collectionsApi
      .remove(name, id)
      .then(() => message && toast(message))
      .catch((e) => {
        q.setData(before);
        return fail(e);
      });
  };

  return { items, loading: q.loading, create, update, remove, reload: q.reload, setItems: q.setData };
}
