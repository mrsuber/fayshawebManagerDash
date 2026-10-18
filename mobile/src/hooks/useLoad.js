import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { errorMessage } from '../services/api';

/**
 * Loads data for a screen and reloads it whenever the screen comes back into view.
 * Returns { data, setData, loading (first load), refreshing (pull-to-refresh), error, reload, refresh }.
 */
export default function useLoad(fetcher, { focus = true, initial = null } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(fetcher);
  ref.current = fetcher;
  const mounted = useRef(true);
  const loadedOnce = useRef(false);

  useEffect(() => () => { mounted.current = false; }, []);

  const reload = useCallback(async () => {
    try {
      const result = await ref.current();
      if (!mounted.current) return result;
      setData(result);
      setError(null);
      loadedOnce.current = true;
      return result;
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
      return undefined;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    if (mounted.current) setRefreshing(false);
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      if (focus || !loadedOnce.current) reload();
    }, [focus, reload]),
  );

  return { data, setData, loading: loading && !loadedOnce.current, refreshing, error, reload, refresh };
}
