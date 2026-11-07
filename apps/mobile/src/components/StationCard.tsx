import {
  describeDiscount,
  discountedPrice,
  formatPrice,
  openingStatus,
  STATION_SERVICE_LABELS,
  type FuelType,
  type StationService,
} from '@tankei/shared';
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
  /** Posto sem preço: atalho para ser o primeiro a informar. */
  onReport?: () => void;
  /**
   * Cartão aberto pelo toque no mapa: mostra também os convênios do
   * combustível escolhido (ADR 0034).
   */
  detailed?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Resumo do posto (nome, bandeira, preço e IQP): na lista e no mapa. */
export function StationCard({
  station,
  fuel,
  onPress,
  onReport,
  detailed = false,
  style,
}: Props) {
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
      <StationFacts station={station} />
      <View style={styles.footer}>
        <Text style={[styles.muted, styles.footerText]}>
          {/* Com a faixa, o prazo já aparece em cima. */}
          {station.mode === 'precos_ocultos'
            ? 'Preços não exibidos'
            : price?.promotion && promotion
              ? 'Preço promocional'
              : price
                ? describePrice(price)
                : 'Ainda sem preço no Tankei'}
        </Text>
        <IqpPill iqp={station.iqp} />
      </View>
      {!price && station.mode !== 'precos_ocultos' && onReport && (
        <Pressable
          style={styles.reportButton}
          onPress={onReport}
          accessibilityRole="button"
          accessibilityLabel={`Informar o preço de ${station.name}`}
        >
          <Text style={styles.reportText}>Informar preço</Text>
        </Pressable>
      )}
      {price && priceNote(price) && (
        <Text style={styles.note} numberOfLines={1}>
          {priceNote(price)}
        </Text>
      )}
      {detailed && <AgreementLines station={station} fuel={fuel} />}
      {/* Deixa claro que o cartão abre a ficha completa. */}
      <View style={styles.more}>
        <Text style={styles.moreText}>Ver detalhes do posto</Text>
        <SymbolView
          name={{
            ios: 'chevron.right',
            android: 'chevron_right',
            web: 'chevron_right',
          }}
          size={18}
          tintColor={colors.primary}
        />
      </View>
    </Pressable>
  );
}

/**
 * Convênios do combustível escolhido (ADR 0034): o preço do cartão é o sem
 * desconto; aqui aparece o preço final em cada convênio.
 */
function AgreementLines({
  station,
  fuel,
}: {
  station: ListedStation;
  fuel: FuelType;
}) {
  const styles = useStyles();
  const price = priceFor(station, fuel)?.price;
  const lines = station.agreements.flatMap((a) => {
    const discount = a.discounts.find((d) => d.fuelType === fuel);
    return discount ? [{ agreement: a, discount }] : [];
  });
  if (lines.length === 0) return null;
  return (
    <View style={styles.agreements}>
      <Text style={styles.agreementsTitle}>Convênios</Text>
      {lines.map(({ agreement, discount }) => (
        <Text
          key={agreement.agreement.id}
          style={styles.agreementLine}
          numberOfLines={2}
        >
          <Text style={styles.agreementName}>{agreement.agreement.name}: </Text>
          {price !== undefined
            ? `R$ ${formatPrice(discountedPrice(price, discount))} (${describeDiscount(discount)})`
            : describeDiscount(discount)}
          {agreement.note ? ` · ${agreement.note}` : ''}
        </Text>
      ))}
    </View>
  );
}

/** Ícones dos serviços (ADR 0033). */
const SERVICE_ICONS: Record<
  StationService,
  { ios: string; android: string; web: string }
> = {
  calibrador: { ios: 'gauge.with.dots.needle.33percent', android: 'speed', web: 'speed' },
  borracharia: { ios: 'wrench.and.screwdriver', android: 'tire_repair', web: 'tire_repair' },
};

/**
 * Aberto agora e serviços (ADR 0033), numa linha. Sem horário informado, não
 * diz nada sobre aberto ou fechado.
 */
function StationFacts({ station }: { station: ListedStation }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const status = openingStatus(station.hours, station.state);
  if (!status && station.services.length === 0) return null;
  return (
    <View style={styles.facts}>
      {status && (
        <View style={styles.fact}>
          <View
            style={[
              styles.dot,
              { backgroundColor: status.open ? colors.success : colors.danger },
            ]}
          />
          <Text
            style={[
              styles.factText,
              { color: status.open ? colors.success : colors.danger },
            ]}
            numberOfLines={1}
          >
            {status.label}
          </Text>
        </View>
      )}
      {station.services.map((service) => (
        <View key={service} style={styles.serviceChip}>
          <SymbolView
            name={
              SERVICE_ICONS[service] as Parameters<typeof SymbolView>[0]['name']
            }
            size={14}
            tintColor={colors.text}
          />
          <Text style={styles.serviceText}>
            {STATION_SERVICE_LABELS[service]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors, badgeColors) => ({
  agreements: {
    gap: 2,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  agreementsTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  agreementLine: { color: colors.text, fontSize: fontSize.sm },
  agreementName: { fontWeight: '700' },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  moreText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  factText: { fontSize: fontSize.sm, fontWeight: '700' },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  serviceText: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
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
  reportButton: {
    alignSelf: 'flex-start',
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  reportText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  // O texto quebra a linha; a pílula do IQP mantém o tamanho (spec 0001).
  footerText: { flex: 1 },
}));
