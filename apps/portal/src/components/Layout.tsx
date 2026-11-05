import BrightnessAutoOutlined from '@mui/icons-material/BrightnessAutoOutlined';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useTheme, type ThemePreference } from '../theme';

/** Largura do menu lateral. */
const SIDEBAR_WIDTH = 272;

const THEME_NEXT: Record<ThemePreference, ThemePreference> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
};
const THEME_LABEL: Record<ThemePreference, string> = {
  auto: 'Tema automático (segue o aparelho)',
  light: 'Tema claro',
  dark: 'Tema escuro',
};
const THEME_ICON: Record<ThemePreference, ReactNode> = {
  auto: <BrightnessAutoOutlined />,
  light: <LightModeOutlined />,
  dark: <DarkModeOutlined />,
};

/**
 * Cabeçalho (logo, tema, conta) e, com `sidebar`, o menu lateral: fixo a
 * partir de 900 px, gaveta no celular.
 */
export function Layout({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
}) {
  const { preference, scheme, setPreference } = useTheme();
  const muiTheme = useMuiTheme();
  const desktop = useMediaQuery(muiTheme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Escolher um item fecha a gaveta.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {sidebar && !desktop && (
            <IconButton
              edge="start"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={open}
              aria-controls="sidebar"
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box
            component={Link}
            to="/"
            aria-label="Tankei: início do portal"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <Box
              component="img"
              src={
                scheme === 'dark'
                  ? '/logo-horizontal-dark.png'
                  : '/logo-horizontal.png'
              }
              alt="Tankei"
              sx={{ height: 30, display: 'block' }}
            />
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' }, ml: 1 }}
          >
            Portal do posto
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={`${THEME_LABEL[preference]}. Clique para trocar.`}>
            <IconButton
              onClick={() => setPreference(THEME_NEXT[preference])}
              aria-label={`${THEME_LABEL[preference]}. Trocar`}
            >
              {THEME_ICON[preference]}
            </IconButton>
          </Tooltip>
          <AccountMenu />
        </Toolbar>
      </AppBar>

      {/* Espaço da barra fixa. */}
      <Toolbar />

      {sidebar ? (
        <Box sx={{ display: 'flex' }}>
          <Drawer
            id="sidebar"
            variant={desktop ? 'permanent' : 'temporary'}
            open={desktop || open}
            onClose={() => setOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              width: { md: SIDEBAR_WIDTH },
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: SIDEBAR_WIDTH,
                boxSizing: 'border-box',
              },
            }}
          >
            <Toolbar />
            <Box
              component="nav"
              aria-label="Menu do posto"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflowY: 'auto',
                py: 1,
              }}
            >
              {sidebar}
            </Box>
          </Drawer>
          <main
            className="page"
            style={{ maxWidth: 1120, flex: 1, minWidth: 0 }}
          >
            {children}
          </main>
        </Box>
      ) : (
        <main className="page">{children}</main>
      )}
    </Box>
  );
}

/** Foto da conta com o menu: nome, e-mail e sair. */
function AccountMenu() {
  const { state, signOut } = useAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (state.status !== 'signedIn') return null;
  const user = state.user;
  const initial = (user.name ?? user.email ?? '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <Tooltip title="Sua conta">
        <IconButton
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label="Sua conta"
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          size="small"
        >
          <Avatar
            src={user.avatarUrl ?? undefined}
            alt=""
            // Foto do Google: sem referer, que às vezes faz a imagem ser recusada.
            slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
            sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}
          >
            {initial}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1, maxWidth: 280 }}>
          <Typography variant="subtitle2" noWrap>
            {user.name ?? 'Sua conta'}
          </Typography>
          {user.email && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {user.email}
            </Typography>
          )}
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            void signOut();
          }}
        >
          <ListItemIcon>
            <LogoutOutlined fontSize="small" />
          </ListItemIcon>
          Sair
        </MenuItem>
      </Menu>
    </>
  );
}
