import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { muiTheme } from '../mui-theme';
import { useTheme } from '../theme';

/**
 * Tema do MUI seguindo a escolha do portal (automático, claro ou escuro), a
 * mesma que o index.css usa: telas migradas e não migradas ficam iguais.
 */
export function MuiProvider({ children }: { children: ReactNode }) {
  const { scheme } = useTheme();
  return (
    <ThemeProvider theme={muiTheme(scheme)}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
