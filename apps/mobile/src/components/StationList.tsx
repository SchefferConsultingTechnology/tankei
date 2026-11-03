import type { FuelType, NearbyStation } from '@tankei/shared';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BADGE_LABELS, formatAge, formatDistance } from '@/format';
import { priceFor, sortByPrice } from '@/stations';
import { colors, fontSize, radius, spacing } from '@/theme';
import { IqpPill } from './IqpPill';
import { PriceTag } from './PriceTag';

interface Props {
  stations: NearbyStation[];
  fuel: FuelType;
  onSelect: (station: NearbyStation) => void;
}

/** Postos do menor para o maior preço do combustível escolhido. */
export function StationList({ stations, fuel, onSelect }: Props) {
  return (
    <FlatList
      data={sortByPrice(stations, fuel)}
      keyExtractor={(station) => station.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => {
        const price = priceFor(item, fuel);
        return (
          <Pressable
            style={styles.card}
            onPress={() => onSelect(item)}
            accessibilityRole="button"
          >
            <View style={styles.header}>
              <View style={styles.titleBox}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {item.brand} · {formatDistance(item.distanceMeters)}
                </Text>
              </View>
              <PriceTag price={price} size="lg" />
            </View>
            <View style={styles.footer}>
              <Text style={styles.muted}>
                {price
                  ? `${BADGE_LABELS[price.badge]} · ${
                      price.stale ? 'desatualizado, ' : ''
                    }${formatAge(price.updatedAt)}`
                  : 'Sem preço informado'}
              </Text>
              <IqpPill iqp={item.iqp} />
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleBox: { flex: 1 },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
