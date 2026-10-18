import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { forgotPassword, resetPassword } from '../api';
import { Monogram } from '../components/ui';
import { useLang } from '../i18n';

/** Roles that work in a dashboard, and where each one lands after signing in. */
const ADMIN_ROLES = ['superadmin', 'content_manager', 'editor'];
export function homeFor(role) {
  if (role === 'manager') return '/manager';
  if (ADMIN_ROLES.includes(role)) return '/admin';
  return null;
}

function AccountCard({ title, lead, children }) {
  return (
    <section className="fs-container" style={{ maxWidth: 520, padding: '80px 16px 120px' }}>
      <div className="fs-card fs-card--gold" style={{ padding: 'clamp(28px, 6vw, 44px)', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Monogram size={48} stroke={1.2} style={{ color: 'var(--gold)' }} />
        <div>
          <h1 className="fs-h1" style={{ fontSize: 40 }}>{title}</h1>
          {lead && <p className="fs-muted" style={{ margin: '10px 0 0', lineHeight: 1.6 }}>{lead}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** One sign-in for everyone: staff go to their dashboard; guests are pointed to the app. */
export function Login() {
  const { login, isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLang();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = location.state?.from?.pathname;

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.mustChangePassword) {
      navigate('/admin/change-password-required', { replace: true, state: { firstLogin: true } });
      return;
    }
    const home = homeFor(user.role);
    if (home) navigate(from && from !== '/login' && from !== '/admin/login' ? from : home, { replace: true });
  }, [isAuthenticated, user, navigate, from]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await login(id.trim(), password);
    setBusy(false);
    if (!res.success) setError(res.error || t('common.error'));
  };

  if (isAuthenticated && user && !homeFor(user.role) && !user.mustChangePassword) {
    return (
      <AccountCard title={`Welcome, ${user.name?.split(' ')[0] || 'guest'}`} lead="Your stays, digital key, wellness bookings and concierge live in the Faysha app. Sign in there with the same email.">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/residences" className="fs-btn fs-btn--gold">{t('nav.book')}</Link>
          <button type="button" className="fs-btn fs-btn--ghost" onClick={logout}>Sign out</button>
        </div>
      </AccountCard>
    );
  }

  return (
    <AccountCard title={t('nav.signin')} lead="Residents and the Faysha team sign in here.">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <label className="fs-field">
          Email or username
          <input className="fs-input" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} required />
        </label>
        <label className="fs-field">
          Password
          <input className="fs-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="fs-alert fs-alert--error" role="alert">{error}</div>}
        <button type="submit" className="fs-btn fs-btn--gold fs-btn--lg" disabled={busy}>
          {busy ? t('book.working') : t('nav.signin')}
        </button>
        <Link to="/forgot-password" style={{ fontSize: 14, textAlign: 'center' }}>Forgot your password?</Link>
      </form>
    </AccountCard>
  );
}

export function ForgotPassword() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, ok: false, error: '' });

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, ok: false, error: '' });
    try {
      await forgotPassword(email.trim());
      setState({ busy: false, ok: true, error: '' });
    } catch (err) {
      setState({ busy: false, ok: false, error: err.message });
    }
  };

  return (
    <AccountCard title="Reset your password" lead="Enter the email on your account and we’ll send you a link to choose a new password.">
      {state.ok ? (
        <div className="fs-alert fs-alert--ok" role="status">If an account exists for {email}, a reset link is on its way. Check your inbox.</div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <label className="fs-field">
            {t('book.email')}
            <input className="fs-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {state.error && <div className="fs-alert fs-alert--error" role="alert">{state.error}</div>}
          <button type="submit" className="fs-btn fs-btn--gold fs-btn--lg" disabled={state.busy}>
            {state.busy ? t('common.sending') : 'Send reset link'}
          </button>
        </form>
      )}
      <Link to="/login" style={{ fontSize: 14 }}>← {t('nav.signin')}</Link>
    </AccountCard>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [state, setState] = useState({ busy: false, ok: false, error: token ? '' : 'This reset link is invalid or incomplete. Please request a new one.' });

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setState({ ...state, error: 'Use at least 8 characters.' });
    if (pw !== pw2) return setState({ ...state, error: 'The passwords do not match.' });
    setState({ busy: true, ok: false, error: '' });
    try {
      await resetPassword(token, pw, pw2);
      setState({ busy: false, ok: true, error: '' });
    } catch (err) {
      setState({ busy: false, ok: false, error: err.message });
    }
    return undefined;
  };

  return (
    <AccountCard title="Choose a new password" lead="Use at least 8 characters.">
      {state.ok ? (
        <>
          <div className="fs-alert fs-alert--ok" role="status">Your password has been changed. You can sign in on the website or in the Faysha app.</div>
          <Link to="/login" className="fs-btn fs-btn--gold">Sign in</Link>
        </>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <label className="fs-field">
            New password
            <input className="fs-input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required disabled={!token} />
          </label>
          <label className="fs-field">
            Confirm password
            <input className="fs-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required disabled={!token} />
          </label>
          {state.error && <div className="fs-alert fs-alert--error" role="alert">{state.error}</div>}
          <button type="submit" className="fs-btn fs-btn--gold fs-btn--lg" disabled={state.busy || !token}>
            {state.busy ? 'Saving…' : 'Save password'}
          </button>
          {!token && <Link to="/forgot-password">Request a new link</Link>}
        </form>
      )}
    </AccountCard>
  );
}

export function NotFound() {
  return (
    <AccountCard title="This page has moved on" lead="The page you were looking for isn’t here. Let us take you somewhere calmer.">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/" className="fs-btn fs-btn--gold">Home</Link>
        <Link to="/residences" className="fs-btn fs-btn--ghost">Residences</Link>
      </div>
    </AccountCard>
  );
}
