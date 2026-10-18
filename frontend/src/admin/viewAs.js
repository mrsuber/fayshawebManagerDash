import { homeFor } from './access';

/**
 * "View as": HQ swaps the signed-in session for a 30-minute read-only one (POST /api/admin/staff/:id/view-as)
 * and keeps the super administrator's own session aside so the banner can switch back.
 */
const RETURN_KEY = 'fayhq.viewAs.return';

export function viewAsSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(RETURN_KEY) || 'null');
    if (!saved) return null;
    return { ...saved, as: JSON.parse(localStorage.getItem('adminUser') || 'null') };
  } catch {
    return null;
  }
}

export function startViewAs({ token, user, expiresAt }, returnTo = '/admin/staff') {
  if (!viewAsSession()) {
    localStorage.setItem(
      RETURN_KEY,
      JSON.stringify({ token: localStorage.getItem('authToken'), user: localStorage.getItem('adminUser'), returnTo, expiresAt }),
    );
  }
  localStorage.setItem('authToken', token);
  localStorage.setItem('adminUser', JSON.stringify(user));
  window.location.assign(homeFor(user) || '/');
}

export function endViewAs() {
  const saved = viewAsSession();
  localStorage.removeItem(RETURN_KEY);
  if (saved?.token) {
    localStorage.setItem('authToken', saved.token);
    localStorage.setItem('adminUser', saved.user);
  } else {
    localStorage.removeItem('authToken');
    localStorage.removeItem('adminUser');
  }
  window.location.assign(saved?.returnTo || '/admin');
}
