import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with a service call. Returns { data, setData, loading, error, reload }.
 * `setData` lets pages apply optimistic updates and socket events to the loaded list.
 */
export default function useApi(fetcher, deps = [], initial = null) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const reload = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetchRef
      .current()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, deps);

  return { data, setData, loading, error, reload };
}
