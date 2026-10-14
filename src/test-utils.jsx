import { ThemeProvider } from '@mui/material';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
import './i18n';
import theme from './theme';

/** Renders UI inside the same providers as src/index.js, at the given route. */
export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[route]}>
        <ToastProvider>
          <AuthProvider>
            <SocketProvider>{ui}</SocketProvider>
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}
