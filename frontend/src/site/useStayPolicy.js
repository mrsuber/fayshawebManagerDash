import { useEffect, useState } from 'react';
import { getStayPolicy } from './api';
import { CHECK_IN_TIME, CHECK_OUT_TIME } from './data';

let cached = null;

/** Standard check-in / check-out times set in FAY OS → Settings (defaults until loaded). */
export default function useStayPolicy() {
  const [policy, setPolicy] = useState(cached || { checkIn: CHECK_IN_TIME, checkOut: CHECK_OUT_TIME });
  useEffect(() => {
    if (cached) return undefined;
    let live = true;
    getStayPolicy()
      .then((p) => {
        cached = p;
        if (live) setPolicy(p);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return policy;
}
