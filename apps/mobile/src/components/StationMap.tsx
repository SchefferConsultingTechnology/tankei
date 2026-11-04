import type { FuelType } from '@tankei/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { Coordinates } from '@/api/queries';
import {
  MARKER_SIZE,
  metersPerPoint,
  placeMarkers,
  type MarkerPlacement,
} from '@/map-stacking';
import {
  isLocated,
  priceFor,
  type ListedStation,
  type LocatedStation,
} from '@/stations';
import { colors } from '@/theme';
import { PriceTag } from './PriceTag';

interface Props {
  stations: ListedStation[];
  fuel: FuelType;
  center: Coordinates;
  showsUserLocation: boolean;
  onSelect: (station: ListedStation) => void;
}

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
  showsUserLocation,
  onSelect,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [latitudeDelta, setLatitudeDelta] = useState(INITIAL_DELTA);
  const [mapHeight, setMapHeight] = useState(0);
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
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: INITIAL_DELTA,
        longitudeDelta: INITIAL_DELTA,
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
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={showsUserLocation}
      toolbarEnabled={false}
    >
      {located.map((station) => (
        <PriceMarker
          key={station.id}
          station={station}
          fuel={fuel}
          placement={
            placements.get(station.id) ?? { offset: { x: 0, y: 0 }, zIndex: 0 }
          }
          onPress={() => onSelect(station)}
        />
      ))}
    </MapView>
  );
}

function PriceMarker({
  station,
  fuel,
  placement,
  onPress,
}: {
  station: LocatedStation;
  fuel: FuelType;
  placement: MarkerPlacement;
  onPress: () => void;
}) {
  const price = priceFor(station, fuel);

  // Marcador com componente React: o mapa redesenha enquanto acompanha
  // mudanças da view. Acompanha só até o conteúdo atual ser desenhado (desempenho).
  const content = `${price?.price}|${price?.badge}|${price?.stale}`;
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
        title={station.name}
        description="Sem preço informado"
        onPress={onPress}
        tracksViewChanges={tracking}
        zIndex={0}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <View style={styles.noPrice} />
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
      title={station.name}
      onPress={onPress}
      tracksViewChanges={tracking}
      zIndex={placement.zIndex}
      // Deslocado para a pilha: anchor (fração do marcador) no Google Maps,
      // centerOffset (pontos) no Apple Maps.
      anchor={{
        x: 0.5 - x / MARKER_SIZE.width,
        y: 1 + y / MARKER_SIZE.height,
      }}
      centerOffset={{ x, y: -y }}
    >
      <PriceTag price={price} />
    </Marker>
  );
}

const styles = StyleSheet.create({
  // Posto sem preço do combustível escolhido: ponto discreto, tocável.
  noPrice: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surface,
    borderColor: colors.textMuted,
    borderWidth: 2,
  },
});
