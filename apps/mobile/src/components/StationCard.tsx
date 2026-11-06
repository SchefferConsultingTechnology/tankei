import type { FuelType } from '@tankei/shared';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { describePrice, formatDistance, priceNote } from '@/format';
import { priceFor, type ListedStation } from '@/stations';
import { createStyles } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';
import { IqpPill } from './IqpPill';
import { PriceTag } from './PriceTag';

interface Props {
  station: ListedStation;
  fuel: FuelType;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Resumo do posto (nome, bandeira, preço e IQP): na lista e no mapa. */
export function StationCard({ station, fuel, onPress, style }: Props) {
  const styles = useStyles();
  const price = priceFor(station, fuel);
  return (
    <Pressable
      style={[styles.card, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Abre os detalhes do posto"
    >
      <View style={styles.header}>
        <View style={styles.titleBox}>
          <Text style={styles.name} numberOfLines={1}>
            {station.name}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {station.distanceMeters === undefined
              ? `${station.brand} · ${station.district ?? station.city}`
              : `${station.brand} · ${formatDistance(station.distanceMeters)}`}
          </Text>
        </View>
        <PriceTag price={price} size="lg" />
      </View>
      <View style={styles.footer}>
        <Text style={[styles.muted, styles.footerText]}>
          {price ? describePrice(price) : 'Sem preço informado'}
        </Text>
        <IqpPill iqp={station.iqp} />
      </View>
      {price && priceNote(price) && (
        <Text style={styles.note} numberOfLines={1}>
          {priceNote(price)}
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleBox: { flex: 1 },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  note: { color: colors.warning, fontSize: fontSize.sm, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  // O texto quebra a linha; a pílula do IQP mantém o tamanho (spec 0001).
  footerText: { flex: 1 },
}));
