import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  formatDistance,
  formatPrice,
  formatUntil,
  FUEL_LABELS,
  type Competitor,
} from '@tankei/shared';
import { useCompetition } from '../api/queries';
import { useStationContext } from './station-context';

type Offer = { fuel: string; price: number; label: string; endsAt: string };

/** Promoções vigentes dos postos no raio máximo (o que o app já mostra). */
export function CompetitorPromotionsPage() {
  const { station } = useStationContext();
  const competition = useCompetition(station.id);

  if (competition.isPending) {
    return <Typography color="text.secondary">Carregando…</Typography>;
  }
  if (competition.isError) {
    return <Alert severity="error">{competition.error.message}</Alert>;
  }

  // Um posto com promoção em vários combustíveis aparece agrupado.
  const byStation = new Map<string, { station: Competitor; offers: Offer[] }>();
  for (const fuel of competition.data.fuels) {
    for (const c of fuel.nearby) {
      if (!c.price.promotion) continue;
      const entry = byStation.get(c.id) ?? { station: c, offers: [] };
      entry.offers.push({
        fuel: FUEL_LABELS[fuel.fuelType],
        price: c.price.price,
        label: c.price.promotion.label,
        endsAt: c.price.promotion.endsAt,
      });
      byStation.set(c.id, entry);
    }
  }
  const promotions = [...byStation.values()].sort(
    (a, b) => a.station.distanceMeters - b.station.distanceMeters,
  );

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
          Promoções da concorrência
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Postos a até {formatDistance(competition.data.radiusMeters)} com preço
          promocional vigente no app, do mais perto ao mais longe.
        </Typography>
      </Box>

      {promotions.length === 0 ? (
        <Alert severity="info">Nenhuma promoção vigente na região.</Alert>
      ) : (
        promotions.map(({ station: s, offers }) => (
          <Paper key={s.id} variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>{s.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {s.brand} · {formatDistance(s.distanceMeters)}
            </Typography>
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {offers.map((o) => (
                <Stack
                  key={o.fuel}
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'flex-start' }}
                >
                  <LocalOfferOutlined
                    fontSize="small"
                    sx={{ color: 'var(--badge-promocao)', mt: 0.25 }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {o.fuel} · “{o.label}”
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatUntil(o.endsAt)}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: 800,
                      color: 'var(--badge-promocao)',
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    R$ {formatPrice(o.price)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        ))
      )}
    </Stack>
  );
}
