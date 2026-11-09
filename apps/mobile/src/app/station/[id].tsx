import {
  FUEL_LABELS,
  IQP_EXPLANATION,
  IQP_SCALE_MAX,
  STATION_MODE_NOTICES,
  VISIT_SOURCES,
  type VisitSource,
  type Station,
  type StationIqp,
} from '@tankei/shared';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  useStation,
  useStationIqp,
  useStationShowcase,
} from '@/api/queries';
import { useFavorites, useToggleFavorite } from '@/api/engagement';
import { useAuth } from '@/auth/AuthProvider';
import { DetourSavingsCard } from '@/components/DetourSavings';
import { OwnerInvite } from '@/components/OwnerInvite';
import { StationAgreements } from '@/components/StationAgreements';
import { StationHours } from '@/components/StationHours';
import { IqpGauge } from '@/components/IqpGauge';
import { useFuelPreference } from '@/hooks/useFuelPreference';
import { PriceTag } from '@/components/PriceTag';
import {
  StationPhotos,
  StationPromotions,
} from '@/components/StationShowcase';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { CONFIDENCE_LABELS, describePrice, priceNote } from '@/format';
import { priceFor } from '@/stations';
import { createStyles, useTheme } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';
import { visits } from '@/visits';

export default function StationScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id, origem } = useLocalSearchParams<{ id: string; origem?: string }>();
  useVisit(id, origem);
  const station = useStation(id);
  const iqp = useStationIqp(id);
  const showcase = useStationShowcase(id);
  const [fuel] = useFuelPreference();
  const promotions = showcase.data?.promotions ?? [];
  const photos = showcase.data?.photos ?? [];
  const bottomPadding = useBottomPadding();

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
    <ScrollView contentContainerStyle={[styles.content, bottomPadding]}>
      <Stack.Screen
        options={{
          title: data.name,
          headerRight: () => <FavoriteButton stationId={data.id} />,
        }}
      />

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
            onPress={() => {
              visits.action(data.id, 'route');
              chooseNavigationApp(data.location!);
            }}
          />
        )}
      </View>

      <StationHours station={data} />

      {promotions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {promotions.length === 1 ? 'Promoção' : 'Promoções'}
          </Text>
          <StationPromotions promotions={promotions} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preços</Text>
        {STATION_MODE_NOTICES[data.mode] && (
          <Text style={styles.modeNotice}>
            {STATION_MODE_NOTICES[data.mode]}
          </Text>
        )}
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
                {price && priceNote(price) && (
                  <Text style={styles.note}>{priceNote(price)}</Text>
                )}
              </View>
              <PriceTag price={price} size="lg" />
            </View>
          );
        })}
        {data.mode !== 'precos_ocultos' && (
          <>
            <DetourSavingsCard
              station={data}
              fuel={data.fuels.includes(fuel) ? fuel : (data.fuels[0] ?? fuel)}
            />
            <SecondaryButton
              label="Informar preço"
              onPress={() =>
                router.push({ pathname: '/station/[id]/preco', params: { id } })
              }
            />
            <View style={styles.actions}>
              <LinkButton
                label="Avisar quando baixar"
                onPress={() =>
                  router.push({ pathname: '/station/[id]/alerta', params: { id } })
                }
              />
              {priceFor(data, 'etanol') && priceFor(data, 'gasolina_comum') && (
                <LinkButton
                  label="Etanol ou gasolina?"
                  onPress={() =>
                    router.push({
                      pathname: '/calculadora',
                      params: {
                        etanol: String(priceFor(data, 'etanol')!.price),
                        gasolina: String(priceFor(data, 'gasolina_comum')!.price),
                      },
                    })
                  }
                />
              )}
            </View>
          </>
        )}
      </View>

      <StationAgreements station={data} />

      {photos.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fotos</Text>
          <StationPhotos photos={photos} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Índice de Qualidade do Posto (IQP)
        </Text>
        {iqp.data ? (
          <IqpDetail iqp={iqp.data} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
        <SecondaryButton
          label="Avaliar este posto"
          onPress={() =>
            router.push({ pathname: '/station/[id]/avaliar', params: { id } })
          }
        />
      </View>

      <OwnerInvite station={data} />
    </ScrollView>
  );
}

function IqpDetail({ iqp }: { iqp: StationIqp }) {
  const styles = useStyles();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.scoreRow}>
        <IqpGauge score={iqp.score} />
        <View style={{ flex: 1, gap: 2 }}>
          {iqp.score === null ? (
            <Text style={styles.body}>
              Dados insuficientes: a nota aparece quando mais pessoas diferentes
              avaliarem ({iqp.reviewers} até agora).
            </Text>
          ) : (
            <>
              <Text style={styles.body}>
                {iqp.confidence ? CONFIDENCE_LABELS[iqp.confidence] : ''}
              </Text>
              <Text style={styles.muted}>
                {iqp.reviewers === 1
                  ? '1 pessoa avaliou'
                  : `${iqp.reviewers} pessoas avaliaram`}
              </Text>
            </>
          )}
        </View>
      </View>
      {iqp.score !== null && (
        <>
          <Text style={styles.muted}>Notas de 0 a {IQP_SCALE_MAX}</Text>
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
                  style={[
                    styles.barFill,
                    { width: `${dimension.score ?? 0}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </>
      )}
      <HowToRead version={iqp.methodologyVersion} />
    </View>
  );
}

/** "Como ler o IQP" (spec 0001): mesmo texto do portal, fechado por padrão. */
function HowToRead({ version }: { version: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.howTo}>
      <Pressable
        style={styles.howToHeader}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.howToTitle}>Como ler o IQP</Text>
        <SymbolView
          name={{
            ios: open ? 'chevron.up' : 'chevron.down',
            android: open ? 'expand_less' : 'expand_more',
            web: open ? 'expand_less' : 'expand_more',
          }}
          size={20}
          tintColor={colors.textMuted}
        />
      </Pressable>
      {open && (
        <View style={{ gap: spacing.sm }}>
          {IQP_EXPLANATION.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.muted}>•</Text>
              <Text style={[styles.muted, { flex: 1 }]}>{line}</Text>
            </View>
          ))}
          <Text style={styles.muted}>
            Índice calculado pelo Tankei com a metodologia {version}.
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Visita à ficha (spec 0003): começa ao abrir, conta o tempo só com a ficha
 * em primeiro plano (outra tela por cima pausa) e termina ao sair.
 */
function useVisit(stationId: string, origem: string | undefined) {
  const source: VisitSource = (VISIT_SOURCES as readonly string[]).includes(
    origem ?? '',
  )
    ? (origem as VisitSource)
    : 'link';
  useEffect(() => {
    visits.detailOpened(stationId, source);
    return () => visits.detailLeft(stationId);
    // A origem só vale na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);
  useFocusEffect(
    useCallback(() => {
      visits.detailFocus(stationId, true);
      return () => visits.detailFocus(stationId, false);
    }, [stationId]),
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
  const styles = useStyles();
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

/** Estrela no cabeçalho: favorita ou desfavorita (com conta). */
function FavoriteButton({ stationId }: { stationId: string }) {
  const { colors } = useTheme();
  const { state } = useAuth();
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const favorite = favorites.data?.some((s) => s.id === stationId) ?? false;
  return (
    <Pressable
      onPress={() =>
        state.status === 'signedIn'
          ? toggle.mutate({ stationId, favorite: !favorite })
          : router.push('/conta')
      }
      disabled={toggle.isPending}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: favorite }}
      accessibilityLabel={favorite ? 'Tirar dos favoritos' : 'Adicionar aos favoritos'}
    >
      <SymbolView
        name={{
          ios: favorite ? 'star.fill' : 'star',
          android: favorite ? 'star' : 'star_outline',
          web: favorite ? 'star' : 'star_outline',
        }}
        size={24}
        tintColor={favorite ? colors.star : colors.text}
      />
    </Pressable>
  );
}

function LinkButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      style={styles.link}
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
    >
      <Text style={styles.linkText}>{label}</Text>
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
  const styles = useStyles();
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

const useStyles = createStyles((colors, badgeColors) => ({
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
  modeNotice: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  note: { color: colors.warning, fontSize: fontSize.sm, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  link: { paddingVertical: spacing.xs },
  linkText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  priceInfo: { flex: 1, gap: 2 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  howTo: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  howToHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  howToTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  dimensionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  bar: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
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
}));
