import { createTheme, type Theme } from '@mui/material/styles';

/**
 * Tema do MUI com a marca Tankei (ADR 0017): os mesmos valores do app e do
 * index.css. O claro usa o azul-marinho como cor de ação; o escuro, o laranja
 * com texto azul-marinho (contraste conferido no ADR 0017).
 */
const navy = '#012049';

const palettes = {
  light: {
    mode: 'light' as const,
    primary: { main: navy, contrastText: '#FFFFFF' },
    secondary: { main: '#E8590C', contrastText: '#FFFFFF' },
    background: { default: '#F5F7FB', paper: '#FFFFFF' },
    text: { primary: '#0F1B33', secondary: '#5B6B85' },
    divider: '#D9E0EA',
    error: { main: '#B91C1C' },
    success: { main: '#15803D' },
    action: {
      selected: 'rgba(1, 32, 73, 0.08)',
      hover: 'rgba(1, 32, 73, 0.05)',
    },
  },
  dark: {
    mode: 'dark' as const,
    primary: { main: '#FF7A1A', contrastText: navy },
    secondary: { main: '#FF8A2B', contrastText: navy },
    background: { default: '#07122A', paper: '#0F1E3D' },
    text: { primary: '#F1F5FB', secondary: '#9AABC6' },
    divider: '#24395F',
    error: { main: '#F87171' },
    success: { main: '#4ADE80' },
    action: {
      selected: 'rgba(255, 122, 26, 0.16)',
      hover: 'rgba(255, 255, 255, 0.06)',
    },
  },
};

const cache: Partial<Record<'light' | 'dark', Theme>> = {};

export function muiTheme(scheme: 'light' | 'dark'): Theme {
  return (cache[scheme] ??= createTheme({
    palette: palettes[scheme],
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      button: { textTransform: 'none', fontWeight: 700 },
    },
    components: {
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'inherit' },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            borderRight: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 8,
            margin: '1px 8px',
            '&.Mui-selected, &.Mui-selected:hover': {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              '& .MuiListItemIcon-root': {
                color: theme.palette.primary.contrastText,
              },
            },
          }),
        },
      },
      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: 36 } },
      },
      MuiListSubheader: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: 'transparent',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            lineHeight: '32px',
            color: theme.palette.text.secondary,
          }),
        },
      },
    },
  }));
}
