import { ScopedCssBaseline, ThemeProvider } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
import i18n from './i18n';
import theme from './theme';
import './styles.css';

/**
 * The FAY OS manager dashboard, mounted by the site at /manager/* (lazy-loaded, see src/App.js).
 *
 * Its stylesheet is scoped to body.fayos, so the class is added to <body> only while the dashboard
 * is on screen; MUI dialogs and menus render into <body> and pick up the same styles.
 */
export default function ManagerApp() {
  useEffect(() => {
    document.body.classList.add('fayos');
    return () => document.body.classList.remove('fayos');
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      {/* injectFirst puts MUI's Emotion styles before ours, so the dashboard's classes can override them. */}
      <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <ScopedCssBaseline sx={{ bgcolor: 'transparent', minHeight: '100vh' }}>
          <ToastProvider>
            <AuthProvider>
              <SocketProvider>
                <App />
              </SocketProvider>
            </AuthProvider>
          </ToastProvider>
        </ScopedCssBaseline>
      </ThemeProvider>
      </StyledEngineProvider>
    </I18nextProvider>
  );
}
