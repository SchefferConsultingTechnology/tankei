import type { FuelType, NearbyStation } from '@tankei/shared';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { Coordinates } from '@/api/queries';
import {
  MARKER_SIZE,
  metersPerPoint,
  placeMarkers,
  type MarkerPlacement,
} from '@/map-stacking';
import { priceFor } from '@/stations';
import { PriceTag } from './PriceTag';

interface Props {
  stations: NearbyStation[];
  fuel: FuelType;
  center: Coordinates;
  showsUserLocation: boolean;
  onSelect: (station: NearbyStation) => void;
}

/** Zoom inicial: cerca de 5 km de altura de tela. */
const INITIAL_DELTA = 0.05;

/** Espaço entre marcadores empilhados, em alturas de marcador. */
const STACK_STEP = 1.15;

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
  const [latitudeDelta, setLatitudeDelta] = useState(INITIAL_DELTA);
  const [mapHeight, setMapHeight] = useState(0);
  const placements = useMemo(
    () =>
      placeMarkers(stations, fuel, metersPerPoint(latitudeDelta, mapHeight)),
    [stations, fuel, latitudeDelta, mapHeight],
  );

  return (
    <MapView
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
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={showsUserLocation}
      toolbarEnabled={false}
    >
      {stations.map((station) => (
        <PriceMarker
          key={station.id}
          station={station}
          fuel={fuel}
          placement={placements.get(station.id) ?? { stack: 0, zIndex: 0 }}
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
  station: NearbyStation;
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

  const lift = placement.stack * STACK_STEP;
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
      // Empilhado acima do ponto do posto: anchor no Google Maps (Android),
      // centerOffset no Apple Maps (iOS).
      anchor={{ x: 0.5, y: 1 + lift }}
      centerOffset={{ x: 0, y: -lift * MARKER_SIZE.height }}
    >
      <PriceTag price={price} />
    </Marker>
  );
}
