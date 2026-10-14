import GoogleIcon from '@mui/icons-material/Google';
import { Alert, Box, Button, Divider, Paper, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/ui';
import config from '../config';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { t } = useTranslation();
  const { user, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const target = location.state?.from?.pathname || '/';
  if (user) return <Navigate to={target} replace />;

  const run = (fn) => {
    setBusy(true);
    setError('');
    fn()
      .then(() => navigate(target, { replace: true }))
      .catch((e) => setError(e.message || t('auth.failed')))
      .finally(() => setBusy(false));
  };

  return (
    <Box className="min-h-screen grid place-items-center p-4" sx={{ background: 'repeating-linear-gradient(135deg,#151a22 0 12px,#11151c 12px 24px)' }}>
      <Paper
        component="form"
        className="w-full max-w-md flex flex-col gap-4 p-8"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => login(email, password));
        }}
      >
        <div className="flex items-center gap-3">
          <Icon name="spa" size={34} color="var(--gold)" />
          <div className="flex flex-col leading-none">
            <span className="font-serif text-[28px] tracking-wide text-ink">FAY OS</span>
            <span className="text-[11px] tracking-[5px] text-gold mt-1">FAYSHA</span>
          </div>
        </div>
        <div>
          <Typography variant="h4" component="h1">
            {t('auth.title')}
          </Typography>
          <Typography color="text.secondary">{t('auth.subtitle')}</Typography>
        </div>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="contained" size="large" disabled={busy}>
          {t('auth.signIn')}
        </Button>
        {config.firebaseEnabled && (
          <>
            <Divider>{t('auth.or')}</Divider>
            <Button variant="outlined" size="large" startIcon={<GoogleIcon />} disabled={busy} onClick={() => run(loginWithGoogle)}>
              {t('auth.google')}
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
