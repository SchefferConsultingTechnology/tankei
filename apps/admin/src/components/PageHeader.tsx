import ArrowBack from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Título da tela, com voltar e ações opcionais. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <Box>
      {back && (
        <Button
          component={Link}
          to={back.to}
          size="small"
          startIcon={<ArrowBack />}
          sx={{ ml: -1, mb: 0.5 }}
        >
          {back.label}
        </Button>
      )}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h5"
            component="h1"
            sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              color="text.secondary"
              component="div"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
      </Stack>
    </Box>
  );
}
