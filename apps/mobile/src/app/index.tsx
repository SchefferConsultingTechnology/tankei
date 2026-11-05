import { FUEL_TYPES } from '@tankei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useCityStations,
  useNearbyStations,
  type Coordinates,
} from '@/api/queries';
import { FuelSelector } from '@/components/FuelSelector';
import { StationCard } from '@/components/StationCard';
import { StationList } from '@/components/StationList';
import { StationMap } from '@/components/StationMap';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { useFuelPreference } from '@/hooks/useFuelPreference';
import { PILOT_CITY_CENTER, useUserLocation } from '@/hooks/useUserLocation';
import { usePlace } from '@/place';
import {
  availableFuels,
  distanceMeters,
  withDistanceFrom,
  type ListedStation,
} from '@/stations';
import { colors, fontSize, radius, spacing } from '@/theme';

type Mode = 'mapa' | 'lista';

/** Deslocamento, em metros, que dispara nova busca de postos por perto. */
const NEARBY_REFRESH_M = 2_000;

export default function HomeScreen() {
  const { place, setPlace } = usePlace();
  const city = place.kind === 'city' ? place.municipality : null;
  const location = useUserLocation();
  const [fuel, setFuel] = useFuelPreference();
  const [mode, setMode] = useState<Mode>('mapa');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const stations: ListedStation[] = useMemo(
    () =>
      userLocation ? withDistanceFrom(found ?? [], userLocation) : (found ?? []),
    // userLocation vem do estado: muda só quando a pessoa se desloca.
    [found, userLocation],
  );
  const center = city
    ? (cityStations.data?.center ?? PILOT_CITY_CENTER)
    : location.coords;
  const fuels = availableFuels(stations, FUEL_TYPES);
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
            {city
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
        <View style={styles.placeRow}>
          <Pressable
            style={styles.placeButton}
            onPress={() => router.push('/cidade')}
            accessibilityRole="button"
            accessibilityLabel="Escolher cidade"
          >
            <Text style={styles.placeLabel}>
              {city ? 'Cidade' : 'Mostrando'}
            </Text>
            <Text style={styles.placeName} numberOfLines={1}>
              {city ? `${city.name}/${city.state}` : 'Perto de você'} ▾
            </Text>
          </Pressable>
          {city && (
            <Pressable
              style={styles.placeClear}
              onPress={() => setPlace({ kind: 'nearby' })}
              accessibilityRole="button"
              accessibilityLabel="Voltar para perto de você"
            >
              <Text style={styles.placeClearText}>Perto de você</Text>
            </Pressable>
          )}
        </View>
        <FuelSelector fuels={fuels} selected={fuel} onSelect={setFuel} />
        <View style={styles.switch}>
          {(['mapa', 'lista'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setMode(option)}
              style={[
                styles.switchItem,
                mode === option && styles.switchActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === option }}
            >
              <Text
                style={[
                  styles.switchText,
                  mode === option && styles.switchTextActive,
                ]}
              >
                {option === 'mapa' ? 'Mapa' : 'Lista (menor preço)'}
              </Text>
            </Pressable>
          ))}
        </View>
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
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  placeButton: { flex: 1 },
  placeLabel: { color: colors.textMuted, fontSize: fontSize.sm },
  placeName: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  placeClear: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  placeClearText: { color: colors.primary, fontSize: fontSize.sm },
  switch: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 3,
  },
  switchItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  switchActive: { backgroundColor: colors.surface },
  switchText: { color: colors.textMuted, fontSize: fontSize.md },
  switchTextActive: { color: colors.text, fontWeight: '600' },
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
    shadowColor: '#000',
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
});
