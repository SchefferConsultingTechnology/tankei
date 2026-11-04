import { FUEL_LABELS, type Station, type StationIqp } from '@tankei/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useStation, useStationIqp } from '@/api/queries';
import { PriceTag } from '@/components/PriceTag';
import { CONFIDENCE_LABELS, describePrice } from '@/format';
import { priceFor } from '@/stations';
import { badgeColors, colors, fontSize, radius, spacing } from '@/theme';

export default function StationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const station = useStation(id);
  const iqp = useStationIqp(id);

  if (station.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (station.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{station.error.message}</Text>
      </View>
    );
  }

  const data = station.data;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: data.name }} />

      <View style={styles.section}>
        <Text style={styles.title}>{data.name}</Text>
        <Text style={styles.muted}>{data.brand}</Text>
        <Text style={styles.body}>
          {[data.address, data.district, `${data.city}/${data.state}`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {data.location && (
          <PrimaryButton
            label="Traçar rota"
            onPress={() => chooseNavigationApp(data.location!)}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preços</Text>
        {data.fuels.length === 0 && (
          <Text style={styles.muted}>Combustíveis ainda não informados.</Text>
        )}
        {data.fuels.map((fuel) => {
          const price = priceFor(data, fuel);
          return (
            <View key={fuel} style={styles.priceRow}>
              <View style={styles.priceInfo}>
                <Text style={styles.body}>{FUEL_LABELS[fuel]}</Text>
                <Text style={styles.muted}>
                  {price ? describePrice(price) : 'Sem preço informado'}
                </Text>
                {price?.promotion && (
                  <Text style={styles.promotion}>{price.promotion.label}</Text>
                )}
              </View>
              <PriceTag price={price} size="lg" />
            </View>
          );
        })}
        <SecondaryButton label="Informar preço" onPress={comingSoon} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Qualidade (IQP)</Text>
        {iqp.data ? (
          <IqpDetail iqp={iqp.data} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
        <SecondaryButton label="Avaliar este posto" onPress={comingSoon} />
      </View>
    </ScrollView>
  );
}

function IqpDetail({ iqp }: { iqp: StationIqp }) {
  if (iqp.score === null) {
    return (
      <Text style={styles.muted}>
        Dados insuficientes: o índice aparece a partir de 3 avaliações de
        pessoas diferentes ({iqp.reviewers} até agora).
      </Text>
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.scoreRow}>
        <Text style={styles.score}>{iqp.score}</Text>
        <Text style={styles.muted}>
          de 100 · {iqp.confidence ? CONFIDENCE_LABELS[iqp.confidence] : ''} ·{' '}
          {iqp.reviewers} avaliações
        </Text>
      </View>
      {iqp.dimensions.map((dimension) => (
        <View key={dimension.dimension} style={{ gap: spacing.xs }}>
          <View style={styles.dimensionHeader}>
            <Text style={styles.body}>{dimension.label}</Text>
            <Text style={styles.muted}>
              {dimension.score === null ? 'sem dados' : dimension.score}
            </Text>
          </View>
          <View style={styles.bar}>
            <View
              style={[styles.barFill, { width: `${dimension.score ?? 0}%` }]}
            />
          </View>
        </View>
      ))}
      <Text style={styles.muted}>
        O IQP mede a experiência relatada por motoristas. Preço e anúncios não
        alteram a nota.
      </Text>
    </View>
  );
}

function comingSoon() {
  Alert.alert(
    'Em breve',
    'Informar preços e avaliar postos estará disponível quando o login for ativado.',
  );
}

/** "Traçar rota" abre o app de navegação instalado (ADR 0010). */
function chooseNavigationApp(location: NonNullable<Station['location']>) {
  const destination = `${location.lat},${location.lng}`;
  const apps = [
    {
      text: 'Google Maps',
      url: `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
    },
    {
      text: 'Waze',
      url: `https://waze.com/ul?ll=${destination}&navigate=yes`,
    },
    ...(Platform.OS === 'ios'
      ? [
          {
            text: 'Apple Maps',
            url: `https://maps.apple.com/?daddr=${destination}`,
          },
        ]
      : []),
  ];
  Alert.alert('Traçar rota com', undefined, [
    ...apps.map(({ text, url }) => ({
      text,
      onPress: () => void Linking.openURL(url),
    })),
    { text: 'Cancelar', style: 'cancel' as const },
  ]);
}

function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.primary}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.secondary}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  body: { color: colors.text, fontSize: fontSize.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  error: { color: colors.danger, fontSize: fontSize.md, padding: spacing.xl },
  promotion: {
    color: badgeColors.promocao,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  priceInfo: { flex: 1, gap: 2 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  score: { color: colors.primary, fontSize: 40, fontWeight: '800' },
  dimensionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  bar: {
    height: 6,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.primary },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryText: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  secondary: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
