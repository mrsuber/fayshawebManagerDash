import { createTheme } from '@mui/material/styles';

/** MUI theme mirroring the design tokens in styles.css / tailwind.config.js. */
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#e8b84a', light: '#f4d27e', contrastText: '#1a1408' },
    secondary: { main: '#9b7bf0' },
    success: { main: '#1f9d55' },
    error: { main: '#d94040' },
    info: { main: '#2f6fe8' },
    background: { default: '#0a0c0f', paper: '#101318' },
    text: { primary: '#ece6da', secondary: '#a9a294' },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    fontFamily: 'Jost, sans-serif',
    h1: { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 },
    h2: { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 },
    h3: { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 },
    h4: { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 },
    h5: { fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid rgba(255,255,255,0.08)' } } },
    MuiMenu: { styleOverrides: { paper: { backgroundColor: '#14171d' } } },
    MuiDialog: { styleOverrides: { paper: { backgroundColor: '#101318' } } },
    MuiIcon: { defaultProps: { baseClassName: 'material-symbols-outlined' } },
  },
});

export default theme;
