import { FUEL_TYPES, type FuelType } from '@tankei/shared';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  useAppConfig,
  useCityStations,
  useNearbyStations,
  type Coordinates,
} from '@/api/queries';
import { FuelPicker } from '@/components/FuelPicker';
import { SpeedCard } from '@/components/SpeedCard';
import {
  isAhead,
  projectPoint,
  SEARCH_AHEAD_M,
  useDriving,
} from '@/driving';
import { SelectField } from '@/components/SelectField';
import { StationCard } from '@/components/StationCard';
import { StationList } from '@/components/StationList';
import { StationMap } from '@/components/StationMap';
import {
  ViewModeSwitch,
  type ViewMode,
} from '@/components/ViewModeSwitch';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { useFuelPreference } from '@/hooks/useFuelPreference';
import { PILOT_CITY_CENTER, useUserLocation } from '@/hooks/useUserLocation';
import { usePlace } from '@/place';
import {
  availableFuels,
  distanceMeters,
  hasPromotion,
  withDistanceFrom,
  type ListedStation,
} from '@/stations';
import { createStyles, useTheme } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

/** Deslocamento, em metros, que dispara nova busca de postos por perto. */
const NEARBY_REFRESH_M = 2_000;
/**
 * Dirigindo, o ponto da busca fica à frente e gira nas curvas: folga maior
 * para não buscar a cada curva (o raio de 15 km cobre a diferença).
 */
const NEARBY_REFRESH_DRIVING_M = 3_000;

export default function HomeScreen() {
  const styles = useStyles();
  const { colors, badgeColors } = useTheme();
  const { place } = usePlace();
  const city = place.kind === 'city' ? place.municipality : null;
  const location = useUserLocation();
  const [fuel, setFuel] = useFuelPreference();
  const [mode, setMode] = useState<ViewMode>('mapa');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Conta os toques em postos: tocar de novo no mesmo recomeça o prazo. */
  const [selectTick, setSelectTick] = useState(0);
  const [onlyPromotions, setOnlyPromotions] = useState(false);
  const cardPadding = useBottomPadding(spacing.md);
  const config = useAppConfig();

  // O cartão aberto pelo toque no mapa fecha sozinho (parâmetro
  // app.map_card_close_seconds, ADR 0033; 0 = não fecha). Cada toque recomeça.
  const closeSeconds = config.data?.mapCardCloseSeconds ?? 0;
  useEffect(() => {
    if (!selectedId || closeSeconds <= 0) return;
    const timer = setTimeout(() => setSelectedId(null), closeSeconds * 1000);
    return () => clearTimeout(timer);
  }, [selectedId, selectTick, closeSeconds]);
  const userLocation =
    !city && location.status === 'granted' ? location.coords : null;

  // Modo direção (ADR 0032): em movimento, com rumo conhecido.
  const motion =
    !city && location.status === 'granted' ? location.motion : null;
  const driving = useDriving(motion);
  // Depois de dirigir, a posição vira um carro (fica no último rumo ao parar).
  // Só caminhando, continua o ponto azul.
  const [hasDriven, setHasDriven] = useState(false);
  if (driving && !hasDriven) setHasDriven(true);
  const heading = driving ? (motion?.heading ?? null) : null;
  const [showBehind, setShowBehind] = useState(false);
  const aheadOnly = userLocation !== null && heading !== null && !showBehind;

  // A busca por proximidade é refeita ao se afastar do ponto da última busca.
  // Dirigindo, o ponto fica alguns km à frente, no sentido do deslocamento.
  const [searchCenter, setSearchCenter] = useState<Coordinates | null>(null);
  const wantedCenter =
    location.coords && heading !== null
      ? projectPoint(location.coords, heading, SEARCH_AHEAD_M)
      : location.coords;
  if (
    wantedCenter &&
    (!searchCenter ||
      distanceMeters(wantedCenter, searchCenter) >
        (heading !== null ? NEARBY_REFRESH_DRIVING_M : NEARBY_REFRESH_M))
  ) {
    setSearchCenter(wantedCenter);
  }

  // Só uma das buscas fica ativa: perto de você ou a cidade escolhida.
  const nearby = useNearbyStations(city ? null : searchCenter);
  const cityStations = useCityStations(city?.code ?? null, fuel);
  const query = city ? cityStations : nearby;

  const found = city ? cityStations.data?.stations : nearby.data;
  const all: ListedStation[] = useMemo(
    () =>
      userLocation ? withDistanceFrom(found ?? [], userLocation) : (found ?? []),
    // userLocation vem do estado: muda só quando a pessoa se desloca.
    [found, userLocation],
  );
  // Filtro "Só promoções" (ADR 0026): vale para o mapa e a lista.
  const promotionCount = all.filter(hasPromotion).length;
  const promoted = onlyPromotions ? all.filter(hasPromotion) : all;
  // Dirigindo, só os postos à frente (o selecionado fica, mesmo se passou).
  const stations =
    aheadOnly && userLocation && heading !== null
      ? promoted.filter(
          (s) =>
            s.id === selectedId ||
            (s.location !== null && isAhead(userLocation, heading, s.location)),
        )
      : promoted;
  const center = city
    ? (cityStations.data?.center ?? PILOT_CITY_CENTER)
    : location.coords;
  const fuels = availableFuels(all, FUEL_TYPES);
  /** Menor preço da região, para abrir a calculadora já preenchida. */
  const cheapest = (fuelType: FuelType) => {
    const prices = all.flatMap((s) => {
      const p = s.prices.find((x) => x.fuelType === fuelType);
      return p ? [p.price] : [];
    });
    return prices.length > 0 ? Math.min(...prices) : undefined;
  };
  if (!fuels.includes(fuel)) fuels.unshift(fuel);

  // Some sozinho quando o posto sai da busca (outra cidade ou outro lugar).
  const selected = stations.find((station) => station.id === selectedId);

  const open = (station: ListedStation) =>
    router.push({ pathname: '/station/[id]', params: { id: station.id } });
  const report = (station: ListedStation) =>
    router.push({ pathname: '/station/[id]/preco', params: { id: station.id } });

  function renderContent() {
    if (query.isPending || !center) {
      return (
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      );
    }
    if (query.isError) {
      return (
        <Centered>
          <Text style={styles.error}>{query.error.message}</Text>
          <Pressable onPress={() => void query.refetch()}>
            <Text style={styles.retry}>Tentar de novo</Text>
          </Pressable>
        </Centered>
      );
    }
    if (mode === 'mapa') {
      return (
        <>
          <StationMap
            // Remonta ao trocar de lugar, para centralizar o mapa no novo ponto.
            key={city?.code ?? 'nearby'}
            stations={stations}
            fuel={fuel}
            center={center}
            userLocation={userLocation}
            driving={heading !== null ? motion : null}
            userHeading={hasDriven ? (motion?.heading ?? null) : null}
            selectedId={selected?.id ?? null}
            onSelect={(station) => {
              setSelectedId(station.id);
              setSelectTick((tick) => tick + 1);
            }}
            onDeselect={() => setSelectedId(null)}
          />
          {selected && (
            <View style={[styles.mapCard, cardPadding]} pointerEvents="box-none">
              <StationCard
                station={selected}
                fuel={fuel}
                onPress={() => open(selected)}
                onReport={() => report(selected)}
                style={styles.mapCardShadow}
              />
            </View>
          )}
        </>
      );
    }
    if (stations.length === 0) {
      return (
        <Centered>
          <Text style={styles.notice}>
            {onlyPromotions
              ? 'Nenhum posto com promoção agora.'
              : city
              ? 'Nenhum posto encontrado nesta cidade.'
              : 'Nenhum posto encontrado por perto.'}
          </Text>
        </Centered>
      );
    }
    return (
      <StationList
        stations={stations}
        fuel={fuel}
        onSelect={open}
        onReport={report}
      />
    );
  }

  const total = cityStations.data?.total ?? 0;
  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <SpeedCard
          speedKmh={
            location.status === 'granted' ? location.motion.speedKmh : null
          }
        />
        <View style={styles.filters}>
          <SelectField
            label={city ? 'Cidade' : 'Mostrando'}
            value={city ? `${city.name}/${city.state}` : 'Perto de você'}
            onPress={() => router.push('/cidade')}
            accessibilityLabel={
              city
                ? `Cidade: ${city.name}. Trocar`
                : 'Mostrando postos perto de você. Escolher cidade'
            }
          />
          <FuelPicker fuels={fuels} selected={fuel} onSelect={setFuel} />
        </View>
        <ViewModeSwitch mode={mode} onChange={setMode} />
        <View style={styles.chips}>
        {(promotionCount > 0 || onlyPromotions) && (
            <Pressable
              onPress={() => setOnlyPromotions((value) => !value)}
              style={[styles.promoChip, onlyPromotions && styles.promoChipActive]}
              accessibilityRole="switch"
              accessibilityState={{ checked: onlyPromotions }}
              accessibilityLabel={`Só postos com promoção (${promotionCount})`}
            >
              <SymbolView
                name={{ ios: 'tag.fill', android: 'sell', web: 'sell' }}
                size={16}
                tintColor={onlyPromotions ? colors.surface : badgeColors.promocao}
              />
              <Text
                style={[
                  styles.promoChipText,
                  onlyPromotions && styles.promoChipTextActive,
                ]}
              >
                Só promoções ({promotionCount})
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/calculadora',
                params: {
                  ...(cheapest('etanol') && {
                    etanol: String(cheapest('etanol')),
                  }),
                  ...(cheapest('gasolina_comum') && {
                    gasolina: String(cheapest('gasolina_comum')),
                  }),
                },
              })
            }
            style={styles.toolChip}
            accessibilityRole="button"
            accessibilityLabel="Etanol ou gasolina? Abrir a calculadora"
          >
            <SymbolView
              name={{ ios: 'function', android: 'calculate', web: 'calculate' }}
              size={16}
              tintColor={colors.primary}
            />
            <Text style={styles.toolChipText}>Etanol ou gasolina?</Text>
          </Pressable>
        </View>
        {heading !== null && (
          <View style={styles.drivingBar}>
            <SymbolView
              name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
              size={16}
              tintColor={colors.primary}
            />
            <Text style={styles.drivingText}>
              {showBehind
                ? 'Dirigindo: mostrando todos os postos'
                : 'Dirigindo: mostrando os postos à frente'}
            </Text>
            <Pressable
              onPress={() => setShowBehind((value) => !value)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.drivingAction}>
                {showBehind ? 'Só à frente' : 'Ver todos'}
              </Text>
            </Pressable>
          </View>
        )}
        {!city && location.status === 'denied' && (
          <Text style={styles.notice}>
            Não foi possível obter sua localização: mostrando o centro de
            Curitibanos.
          </Text>
        )}
        {!city && nearby.isSuccess && stations.length === 0 && (
          <Text style={styles.notice}>
            Nenhum posto num raio de 15 km. Toque em “Perto de você” para
            escolher uma cidade.
          </Text>
        )}
        {city && total > stations.length && (
          <Text style={styles.notice}>
            Mostrando os {stations.length} postos mais baratos de{' '}
            {total.toLocaleString('pt-BR')} na cidade.
          </Text>
        )}
      </View>

      <View style={styles.content}>{renderContent()}</View>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <View style={styles.centered}>{children}</View>;
}

const useStyles = createStyles((colors, badgeColors) => ({
  screen: { flex: 1 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  toolChipText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  promoChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: badgeColors.promocao,
  },
  promoChipActive: { backgroundColor: badgeColors.promocao },
  promoChipText: {
    color: badgeColors.promocao,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  promoChipTextActive: { color: colors.surface },
  toolbar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  notice: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  content: { flex: 1 },
  drivingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  drivingText: { flex: 1, color: colors.text, fontSize: fontSize.sm },
  drivingAction: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  mapCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
  },
  mapCardShadow: {
    elevation: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  error: { color: colors.danger, fontSize: fontSize.md, textAlign: 'center' },
  retry: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
}));
