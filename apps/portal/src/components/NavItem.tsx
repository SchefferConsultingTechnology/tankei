import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import type { ReactNode } from 'react';
import { Link, useMatch, useResolvedPath } from 'react-router';

/** Item do menu lateral, destacado quando é a tela atual. */
export function NavItem({
  to,
  label,
  icon,
  end = false,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}) {
  const resolved = useResolvedPath(to);
  const active = useMatch({ path: resolved.pathname, end }) !== null;
  return (
    <ListItemButton
      component={Link}
      to={to}
      selected={active}
      aria-current={active ? 'page' : undefined}
      sx={{ py: 0.75 }}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText
        primary={label}
        slotProps={{
          primary: { variant: 'body2', sx: { fontWeight: active ? 700 : 500 } },
        }}
      />
    </ListItemButton>
  );
}
