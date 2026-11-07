import {
  describeDiscount,
  discountedPrice,
  FUEL_LABELS,
  formatPrice,
  type Station,
} from '@tankei/shared';
import { Text, View } from 'react-native';
import { createStyles } from '@/appearance';
import { priceFor } from '@/stations';
import { fontSize, radius, spacing } from '@/theme';

/**
 * Convênios na ficha do posto (ADR 0034): por convênio, o desconto e o preço
 * final de cada combustível. Os preços da ficha continuam sem desconto.
 */
export function StationAgreements({ station }: { station: Station }) {
  const styles = useStyles();
  if (station.agreements.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Convênios</Text>
      <Text style={styles.muted}>
        Descontos informados pelo posto. Os preços acima são sem desconto.
      </Text>
      {station.agreements.map((item) => (
        <View key={item.agreement.id} style={styles.item}>
          <Text style={styles.name}>{item.agreement.name}</Text>
          {item.note && <Text style={styles.muted}>{item.note}</Text>}
          {item.discounts.map((d) => {
            const price = priceFor(station, d.fuelType)?.price;
            return (
              <View key={d.fuelType} style={styles.row}>
                <Text style={styles.fuel}>{FUEL_LABELS[d.fuelType]}</Text>
                <Text style={styles.value}>
                  {price !== undefined
                    ? `R$ ${formatPrice(discountedPrice(price, d))} `
                    : ''}
                  <Text style={styles.discount}>({describeDiscount(d)})</Text>
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  item: {
    gap: 2,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  name: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  fuel: { color: colors.textMuted, fontSize: fontSize.md },
  value: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  discount: { color: colors.success, fontWeight: '600' },
}));
