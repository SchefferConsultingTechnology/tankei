import { FUEL_TYPES } from '@tankei/shared';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  useCityStations,
  useNearbyStations,
  type Coordinates,
} from '@/api/queries';
import { FuelPicker } from '@/components/FuelPicker';
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

export default function HomeScreen() {
  const styles = useStyles();
  const { colors, badgeColors } = useTheme();
  const { place } = usePlace();
  const city = place.kind === 'city' ? place.municipality : null;
  const location = useUserLocation();
  const [fuel, setFuel] = useFuelPreference();
  const [mode, setMode] = useState<ViewMode>('mapa');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyPromotions, setOnlyPromotions] = useState(false);
  const cardPadding = useBottomPadding(spacing.md);

  // A busca por proximidade é refeita ao se afastar do ponto da última busca.
  const [searchCenter, setSearchCenter] = useState<Coordinates | null>(null);
  if (
    location.coords &&
    (!searchCenter ||
      distanceMeters(location.coords, searchCenter) > NEARBY_REFRESH_M)
  ) {
    setSearchCenter(location.coords);
  }
  const userLocation =
    !city && location.status === 'granted' ? location.coords : null;

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
  const stations = onlyPromotions ? all.filter(hasPromotion) : all;
  const center = city
    ? (cityStations.data?.center ?? PILOT_CITY_CENTER)
    : location.coords;
  const fuels = availableFuels(all, FUEL_TYPES);
  if (!fuels.includes(fuel)) fuels.unshift(fuel);

  // Some sozinho quando o posto sai da busca (outra cidade ou outro lugar).
  const selected = stations.find((station) => station.id === selectedId);

  const open = (station: ListedStation) =>
    router.push({ pathname: '/station/[id]', params: { id: station.id } });

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
            selectedId={selected?.id ?? null}
            onSelect={(station) => setSelectedId(station.id)}
            onDeselect={() => setSelectedId(null)}
          />
          {selected && (
            <View style={[styles.mapCard, cardPadding]} pointerEvents="box-none">
              <StationCard
                station={selected}
                fuel={fuel}
                onPress={() => open(selected)}
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
    return <StationList stations={stations} fuel={fuel} onSelect={open} />;
  }

  const total = cityStations.data?.total ?? 0;
  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
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
  promoChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
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
