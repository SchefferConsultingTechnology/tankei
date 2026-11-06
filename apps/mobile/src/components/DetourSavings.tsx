import { FUEL_LABELS, type FuelType, type Station } from '@tankei/shared';
import { Text, View } from 'react-native';
import { useNearbyStations } from '@/api/queries';
import { createStyles } from '@/appearance';
import { detourSavings } from '@/fuel-economy';
import { formatDistance } from '@/format';
import { DEFAULT_KM_PER_LITER, useCarProfile } from '@/hooks/useCarProfile';
import { useUserLocation } from '@/hooks/useUserLocation';
import { distanceMeters, priceFor } from '@/stations';
import { fontSize, radius, spacing } from '@/theme';

const money = (value: number) =>
  Math.abs(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

/**
 * "Vale a pena ir até lá?" (ADR 0029): compara com o posto com preço mais
 * perto de você e desconta o desvio (ida e volta), num tanque cheio. Só com
 * a localização real; a conta fica no aparelho.
 */
export function DetourSavingsCard({
  station,
  fuel,
}: {
  station: Station;
  fuel: FuelType;
}) {
  const styles = useStyles();
  const location = useUserLocation();
  const coords = location.status === 'granted' ? location.coords : null;
  const nearby = useNearbyStations(coords);
  const [car] = useCarProfile();

  const thisPrice = priceFor(station, fuel)?.price;
  if (!coords || !station.location || thisPrice === undefined || !nearby.data) {
    return null;
  }

  const withPrice = nearby.data
    .map((s) => ({ station: s, price: priceFor(s, fuel)?.price }))
    .filter(
      (s): s is { station: (typeof nearby.data)[number]; price: number } =>
        s.price !== undefined,
    )
    .map((s) => ({ ...s, meters: distanceMeters(coords, s.station.location) }))
    .sort((a, b) => a.meters - b.meters);
  const reference = withPrice.find((s) => s.station.id !== station.id);
  const toThis = distanceMeters(coords, station.location);
  if (!reference || reference.meters >= toThis) return null;

  const kmPerLiter =
    (fuel === 'etanol' ? car.kmPerLiterEthanol : car.kmPerLiterGasoline) ??
    DEFAULT_KM_PER_LITER;
  const result = detourSavings({
    thisPrice,
    referencePrice: reference.price,
    tankLiters: car.tankLiters,
    extraMeters: toThis - reference.meters,
    kmPerLiter,
  });
  const worth = result.net > 0.5;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Vale a pena ir até lá?</Text>
      <Text style={styles.verdict}>
        {worth
          ? `Sim: economia de cerca de ${money(result.net)}`
          : result.gross > 0
            ? 'Quase não compensa'
            : 'Não compensa'}
      </Text>
      <Text style={styles.muted}>
        Comparado a {reference.station.name}, o posto com preço mais perto de
        você ({formatDistance(reference.meters)}), num tanque de{' '}
        {car.tankLiters} L de {FUEL_LABELS[fuel].toLowerCase()}:{' '}
        {result.gross >= 0 ? 'economia' : 'gasto a mais'} de{' '}
        {money(result.gross)} no preço, menos cerca de{' '}
        {money(result.detourCost)} do desvio (ida e volta).
      </Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  verdict: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
}));
