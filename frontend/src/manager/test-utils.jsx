import { ThemeProvider } from '@mui/material';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider as SiteAuthProvider } from '../contexts/AuthContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
import { href } from './data/pages';
import i18n from './i18n';
import theme from './theme';

/** Renders UI inside the same providers as ManagerApp, mounted at /manager/* like the site does. `route` is a dashboard path. */
export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <SiteAuthProvider>
          <MemoryRouter initialEntries={[href(route)]}>
            <ToastProvider>
              <AuthProvider>
                <SocketProvider>
                  <Routes>
                    <Route path="/manager/*" element={ui} />
                  </Routes>
                </SocketProvider>
              </AuthProvider>
            </ToastProvider>
          </MemoryRouter>
        </SiteAuthProvider>
      </ThemeProvider>
    </I18nextProvider>,
  );
}
