import type { FuelType } from '@tankei/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { Coordinates } from '@/api/queries';
import {
  MARKER_SIZE,
  metersPerPoint,
  placeMarkers,
  type MarkerPlacement,
} from '@/map-stacking';
import { DARK_MAP_STYLE } from '@/map-dark-style';
import {
  isLocated,
  priceFor,
  type ListedStation,
  type LocatedStation,
} from '@/stations';
import { createStyles, useTheme } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';
import { PriceTag } from './PriceTag';

interface Props {
  stations: ListedStation[];
  fuel: FuelType;
  center: Coordinates;
  /** Posição da pessoa, que o mapa acompanha; nula na busca por cidade. */
  userLocation: Coordinates | null;
  /** Posto destacado no mapa (o cartão dele aparece por cima). */
  selectedId: string | null;
  onSelect: (station: ListedStation) => void;
  /** Toque fora dos marcadores. */
  onDeselect: () => void;
}

/** Marcador selecionado fica por cima da pilha. */
const TOP_Z_INDEX = 1_000_000;

/** Zoom inicial: cerca de 5 km de altura de tela. */
const INITIAL_DELTA = 0.05;

/**
 * Mapa de postos com o preço do combustível escolhido em cada marcador.
 * Único ponto do app que conhece o provedor de mapas (ADR 0010): trocar de
 * biblioteca significa reescrever só este componente.
 */
export function StationMap({
  stations,
  fuel,
  center,
  userLocation,
  selectedId,
  onSelect,
  onDeselect,
}: Props) {
  const styles = useStyles();
  const { scheme } = useTheme();
  const mapRef = useRef<MapView>(null);
  const [latitudeDelta, setLatitudeDelta] = useState(INITIAL_DELTA);
  const [mapHeight, setMapHeight] = useState(0);
  // Segue a pessoa até ela arrastar o mapa; o botão volta a seguir.
  const [following, setFollowing] = useState(true);
  const followsUser = following && userLocation !== null;

  useEffect(() => {
    if (!followsUser) return;
    mapRef.current?.animateCamera(
      { center: { latitude: userLocation.lat, longitude: userLocation.lng } },
      { duration: 500 },
    );
  }, [followsUser, userLocation?.lat, userLocation?.lng]);
  // Postos sem coordenada não vão para o mapa (aparecem na lista).
  const located = useMemo(() => stations.filter(isLocated), [stations]);
  // Só os postos com preço disputam espaço: os sem preço viram um ponto discreto.
  const placements = useMemo(
    () =>
      placeMarkers(
        located.filter((station) => priceFor(station, fuel)),
        fuel,
        metersPerPoint(latitudeDelta, mapHeight),
      ),
    [located, fuel, latitudeDelta, mapHeight],
  );

  return (
    <View style={StyleSheet.absoluteFill}>
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: INITIAL_DELTA,
        longitudeDelta: INITIAL_DELTA,
      }}
      onPress={(event) => {
        // No iOS, o toque no marcador também chega ao mapa.
        if (event.nativeEvent.action !== 'marker-press') onDeselect();
      }}
      onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}
      onRegionChangeComplete={(region) =>
        setLatitudeDelta(region.latitudeDelta)
      }
      // O Android ajusta o zoom inicial à proporção da tela sem avisar pela
      // mudança de região: lê a área visível real assim que o mapa fica pronto.
      onMapReady={() => {
        void mapRef.current
          ?.getMapBoundaries()
          .then(({ northEast, southWest }) =>
            setLatitudeDelta(northEast.latitude - southWest.latitude),
          )
          .catch(() => undefined);
      }}
      onPanDrag={() => setFollowing(false)}
      showsUserLocation={userLocation !== null}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      // Segue o tema do app (inclusive a escolha fixa na Conta). No Android,
      // quem escurece o mapa é o estilo JSON.
      userInterfaceStyle={scheme}
      customMapStyle={scheme === 'dark' ? DARK_MAP_STYLE : []}
    >
      {located.map((station) => (
        <PriceMarker
          key={station.id}
          station={station}
          fuel={fuel}
          selected={station.id === selectedId}
          placement={
            placements.get(station.id) ?? { offset: { x: 0, y: 0 }, zIndex: 0 }
          }
          onPress={() => onSelect(station)}
        />
      ))}
    </MapView>
    {userLocation && !following && (
      <Pressable
        style={styles.follow}
        onPress={() => setFollowing(true)}
        accessibilityRole="button"
      >
        <Text style={styles.followText}>Seguir minha posição</Text>
      </Pressable>
    )}
    </View>
  );
}

function PriceMarker({
  station,
  fuel,
  selected,
  placement,
  onPress,
}: {
  station: LocatedStation;
  fuel: FuelType;
  selected: boolean;
  placement: MarkerPlacement;
  onPress: () => void;
}) {
  const styles = useStyles();
  const price = priceFor(station, fuel);

  // Marcador com componente React: o mapa redesenha enquanto acompanha
  // mudanças da view. Acompanha só até o conteúdo atual ser desenhado (desempenho).
  const content = `${price?.price}|${price?.badge}|${price?.stale}|${selected}`;
  const [drawn, setDrawn] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDrawn(content), 500);
    return () => clearTimeout(timer);
  }, [content]);
  const tracking = drawn !== content;

  if (!price) {
    return (
      <Marker
        identifier={station.id}
        coordinate={{
          latitude: station.location.lat,
          longitude: station.location.lng,
        }}
        // Sem title: o nome aparece no cartão, não no balão do mapa.
        onPress={onPress}
        tracksViewChanges={tracking}
        zIndex={selected ? TOP_Z_INDEX : 0}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <View style={[styles.noPrice, selected && styles.noPriceSelected]} />
      </Marker>
    );
  }

  const { x, y } = placement.offset;
  return (
    <Marker
      identifier={station.id}
      coordinate={{
        latitude: station.location.lat,
        longitude: station.location.lng,
      }}
      onPress={onPress}
      tracksViewChanges={tracking}
      zIndex={selected ? TOP_Z_INDEX : placement.zIndex}
      // Deslocado para a pilha: anchor (fração do marcador) no Google Maps,
      // centerOffset (pontos) no Apple Maps.
      anchor={{
        x: 0.5 - x / MARKER_SIZE.width,
        y: 1 + y / MARKER_SIZE.height,
      }}
      centerOffset={{ x, y: -y }}
    >
      <PriceTag price={price} highlighted={selected} />
    </Marker>
  );
}

const useStyles = createStyles((colors) => ({
  // Posto sem preço do combustível escolhido: ponto discreto, tocável.
  noPrice: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surface,
    borderColor: colors.textMuted,
    borderWidth: 2,
  },
  follow: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  followText: {
    color: colors.primaryText,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  noPriceSelected: { borderColor: colors.primary, borderWidth: 4 },
}));
