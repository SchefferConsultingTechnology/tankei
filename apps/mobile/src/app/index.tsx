import { FUEL_TYPES, type NearbyStation } from '@tankei/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNearbyStations } from '@/api/queries';
import { FuelSelector } from '@/components/FuelSelector';
import { StationList } from '@/components/StationList';
import { StationMap } from '@/components/StationMap';
import { useFuelPreference } from '@/hooks/useFuelPreference';
import { useUserLocation } from '@/hooks/useUserLocation';
import { availableFuels } from '@/stations';
import { colors, fontSize, radius, spacing } from '@/theme';

type Mode = 'mapa' | 'lista';

export default function HomeScreen() {
  const location = useUserLocation();
  const [fuel, setFuel] = useFuelPreference();
  const [mode, setMode] = useState<Mode>('mapa');
  const nearby = useNearbyStations(location.coords);

  const stations = nearby.data ?? [];
  const fuels = availableFuels(stations, FUEL_TYPES);
  if (!fuels.includes(fuel)) fuels.unshift(fuel);

  const open = (station: NearbyStation) =>
    router.push({ pathname: '/station/[id]', params: { id: station.id } });

  function renderContent() {
    if (location.status === 'loading' || nearby.isPending) {
      return (
        <Centered>
          <ActivityIndicator color={colors.primary} />
        </Centered>
      );
    }
    if (nearby.isError) {
      return (
        <Centered>
          <Text style={styles.error}>{nearby.error.message}</Text>
          <Pressable onPress={() => void nearby.refetch()}>
            <Text style={styles.retry}>Tentar de novo</Text>
          </Pressable>
        </Centered>
      );
    }
    if (mode === 'mapa') {
      return (
        <StationMap
          stations={stations}
          fuel={fuel}
          center={location.coords}
          showsUserLocation={location.status === 'granted'}
          onSelect={open}
        />
      );
    }
    if (stations.length === 0) {
      return (
        <Centered>
          <Text style={styles.notice}>Nenhum posto encontrado por perto.</Text>
        </Centered>
      );
    }
    return <StationList stations={stations} fuel={fuel} onSelect={open} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
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
        {location.status === 'denied' && (
          <Text style={styles.notice}>
            Sem acesso à localização: mostrando o centro de Curitibanos.
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
