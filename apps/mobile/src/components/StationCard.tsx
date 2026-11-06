import type { FuelType } from '@tankei/shared';
import { SymbolView } from 'expo-symbols';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  describePrice,
  formatDistance,
  formatUntil,
  priceNote,
} from '@/format';
import {
  priceFor,
  promotionHighlight,
  type ListedStation,
} from '@/stations';
import { createStyles, useTheme } from '@/appearance';
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
  const { colors } = useTheme();
  const price = priceFor(station, fuel);
  const promotion = promotionHighlight(station, fuel);
  return (
    <Pressable
      style={[styles.card, promotion && styles.cardPromotion, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Abre os detalhes do posto"
    >
      {promotion && (
        <View style={styles.band}>
          <SymbolView
            name={{ ios: 'tag.fill', android: 'sell', web: 'sell' }}
            size={14}
            tintColor={colors.surface}
          />
          <Text style={styles.bandText} numberOfLines={1}>
            {promotion.title}
            {promotion.others > 0 ? ` +${promotion.others}` : ''} ·{' '}
            {formatUntil(promotion.endsAt)}
          </Text>
        </View>
      )}
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
          {/* Com a faixa, o prazo já aparece em cima. */}
          {price?.promotion && promotion
            ? 'Preço promocional'
            : price
              ? describePrice(price)
              : 'Sem preço informado'}
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

const useStyles = createStyles((colors, badgeColors) => ({
  // Promoção (ADR 0026): borda e faixa na cor de promoção, com o nome e o
  // prazo. Não muda a ordem da lista (menor preço).
  cardPromotion: { borderColor: badgeColors.promocao, borderWidth: 1.5 },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: badgeColors.promocao,
    marginTop: -spacing.md,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  bandText: {
    flex: 1,
    color: colors.surface,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    // A faixa de promoção acompanha os cantos arredondados.
    overflow: 'hidden',
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
