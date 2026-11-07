import type { FuelType } from '@tankei/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Coordinates } from '@/api/queries';
import { projectPoint, zoomForSpeed, type Motion } from '@/driving';
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
  /**
   * Movimento de quem dirige (modo direção, ADR 0032): o mapa gira no rumo e
   * ajusta o zoom pela velocidade. Nulo parado ou fora do modo direção.
   */
  driving: Motion | null;
  /**
   * Rumo conhecido da pessoa: com ele, o ponto azul vira um carro apontando
   * para onde ela vai (fica no último rumo ao parar).
   */
  userHeading: number | null;
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

/** Com o mapa mais perto que isto (~2 km de altura), o nome aparece. */
const NAME_LABEL_DELTA = 0.02;

/** Vidros do carro da posição (desenho fixo, igual nos dois temas). */
const CAR_GLASS = 'rgba(16, 32, 64, 0.85)';

/** Dirigindo, o carro fica esta fração da altura abaixo do centro. */
const AHEAD_SCREEN_FRACTION = 0.25;

/** Altura visível do mapa, em metros, num zoom do Google Maps (tiles de 256 dp). */
function visibleMeters(zoom: number, lat: number, heightDp: number): number {
  const metersPerDp =
    (156_543.03 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  return metersPerDp * (heightDp || 600);
}

/** Bomba de combustível (Material "local_gas_station"), 24 × 24. */
const PUMP_PATH =
  'M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z';

/** Nome curto para o mapa (sem cortar no meio da palavra quando der). */
function shortName(name: string, max = 22): string {
  if (name.length <= max) return name;
  const cut = name.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > 10 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

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
  driving,
  userHeading,
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

  // Zoom escolhido pelo modo direção; nulo fora dele (vale o da pessoa).
  const autoZoom = useRef<number | null>(null);
  const heading = driving?.heading ?? null;
  const speedKmh = driving?.speedKmh ?? null;

  const userLat = userLocation?.lat;
  const userLng = userLocation?.lng;

  useEffect(() => {
    if (!following || userLat === undefined || userLng === undefined) return;
    const position = { lat: userLat, lng: userLng };
    if (heading === null || speedKmh === null) {
      autoZoom.current = null;
      mapRef.current?.animateCamera(
        { center: { latitude: userLat, longitude: userLng } },
        { duration: 500 },
      );
      return;
    }
    // Dirigindo: mapa no rumo, zoom pela velocidade (só troca de faixa com
    // folga) e o carro abaixo do centro, para mostrar mais da estrada à frente.
    // O zoom só é aplicado ao trocar de faixa: o zoom feito com os dedos
    // vale até a próxima troca.
    const zoom = zoomForSpeed(speedKmh, autoZoom.current);
    const zoomChanged = zoom !== autoZoom.current;
    autoZoom.current = zoom;
    const center = projectPoint(
      position,
      heading,
      AHEAD_SCREEN_FRACTION * visibleMeters(zoom, userLat, mapHeight),
    );
    mapRef.current?.animateCamera(
      {
        center: { latitude: center.lat, longitude: center.lng },
        heading,
        pitch: 0,
        ...(zoomChanged && { zoom }),
      },
      { duration: 800 },
    );
  }, [following, userLat, userLng, heading, speedKmh, mapHeight]);
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
      showsUserLocation={userLocation !== null && userHeading === null}
      // Mapa girado: a bússola aparece e, tocada, volta o norte para cima.
      showsCompass
      showsMyLocationButton={false}
      toolbarEnabled={false}
      // Segue o tema do app (inclusive a escolha fixa na Conta). No Android,
      // quem escurece o mapa é o estilo JSON.
      userInterfaceStyle={scheme}
      customMapStyle={scheme === 'dark' ? DARK_MAP_STYLE : []}
    >
      {userLocation && userHeading !== null && (
        <UserCarMarker location={userLocation} heading={userHeading} />
      )}
      {located.map((station) => (
        <PriceMarker
          key={station.id}
          station={station}
          fuel={fuel}
          selected={station.id === selectedId}
          showName={latitudeDelta < NAME_LABEL_DELTA}
          placement={
            placements.get(station.id) ?? { offset: { x: 0, y: 0 }, zIndex: 0 }
          }
          onPress={() => onSelect(station)}
        />
      ))}
    </MapView>
    {speedKmh !== null && (
      <View style={styles.speed} pointerEvents="none">
        <Text
          style={styles.speedValue}
          accessibilityLabel={`${Math.round(speedKmh)} quilômetros por hora`}
        >
          {Math.round(speedKmh)}
        </Text>
        <Text style={styles.speedUnit}>km/h</Text>
      </View>
    )}
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

/**
 * Carro visto de cima no lugar do ponto azul (como no Google Maps). Marcador
 * "flat": gira junto com o mapa e aponta para o rumo em relação ao norte.
 */
function UserCarMarker({
  location,
  heading,
}: {
  location: Coordinates;
  heading: number;
}) {
  const { colors } = useTheme();
  // Redesenha só quando a aparência muda (desempenho).
  const [drawn, setDrawn] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDrawn(colors.accent), 500);
    return () => clearTimeout(timer);
  }, [colors.accent]);
  return (
    <Marker
      identifier="user-car"
      coordinate={{ latitude: location.lat, longitude: location.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={heading}
      tappable={false}
      tracksViewChanges={drawn !== colors.accent}
      zIndex={TOP_Z_INDEX + 1}
      accessibilityLabel="Sua posição"
    >
      <Svg width={26} height={42} viewBox="0 0 26 42">
        {/* Carroceria com contorno branco, para destacar sobre o mapa. */}
        <Rect
          x={2}
          y={2}
          width={22}
          height={38}
          rx={9}
          fill={colors.accent}
          stroke="#FFFFFF"
          strokeWidth={2.5}
        />
        {/* Para-brisa (frente, em cima) e vidro traseiro. */}
        <Path d="M6 13 L20 13 L18 19 L8 19 Z" fill={CAR_GLASS} />
        <Path d="M8 30 L18 30 L19.5 35 L6.5 35 Z" fill={CAR_GLASS} />
        {/* Faróis. */}
        <Rect x={6} y={4.5} width={4} height={2.5} rx={1} fill="#FFF6D5" />
        <Rect x={16} y={4.5} width={4} height={2.5} rx={1} fill="#FFF6D5" />
      </Svg>
    </Marker>
  );
}

function PriceMarker({
  station,
  fuel,
  selected,
  showName,
  placement,
  onPress,
}: {
  station: LocatedStation;
  fuel: FuelType;
  selected: boolean;
  /** Mapa aproximado: o posto sem preço mostra o nome. */
  showName: boolean;
  placement: MarkerPlacement;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const price = priceFor(station, fuel);

  // Marcador com componente React: o mapa redesenha enquanto acompanha
  // mudanças da view. Acompanha só até o conteúdo atual ser desenhado (desempenho).
  const content = `${price?.price}|${price?.badge}|${price?.stale}|${selected}|${showName}|${colors.surface}`;
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
        // Sem title: o nome aparece ao lado (mapa aproximado) e no cartão.
        onPress={onPress}
        tracksViewChanges={tracking}
        zIndex={selected ? TOP_Z_INDEX : 0}
        // O ícone fica sobre o ponto; o nome, centralizado embaixo (altura
        // fixa: ícone 22 + 2 + nome 16 = 40; centro do ícone a 11 do topo).
        anchor={{ x: 0.5, y: showName ? 11 / 40 : 0.5 }}
        centerOffset={showName ? { x: 0, y: 9 } : undefined}
        accessibilityLabel={`${station.name}, sem preço no Tankei`}
      >
        <View style={styles.noPriceRow}>
          <View style={[styles.noPrice, selected && styles.noPriceSelected]}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d={PUMP_PATH}
                fill={selected ? colors.primary : colors.textMuted}
              />
            </Svg>
          </View>
          {showName && (
            <Text style={styles.noPriceName} numberOfLines={1}>
              {shortName(station.name)}
            </Text>
          )}
        </View>
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
  // Posto sem preço do combustível escolhido: ícone de bomba, discreto e
  // tocável; com o mapa aproximado, o nome ao lado.
  noPriceRow: { alignItems: 'center', gap: 2 },
  noPrice: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.textMuted,
    borderWidth: 1.5,
  },
  noPriceName: {
    maxWidth: 140,
    height: 16,
    lineHeight: 14,
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
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
  // Velocidade no modo direção (canto superior esquerdo, como no Waze).
  speed: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    minWidth: 64,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  speedValue: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  speedUnit: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  noPriceSelected: { borderColor: colors.primary, borderWidth: 2.5 },
}));
