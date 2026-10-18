import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { href } from '../data/pages';

/** useNavigate() for dashboard paths: nav('/guest360?guest=3') goes to /manager/guest360?guest=3. */
export default function useNav() {
  const navigate = useNavigate();
  return useCallback((path, options) => navigate(href(path), options), [navigate]);
}
