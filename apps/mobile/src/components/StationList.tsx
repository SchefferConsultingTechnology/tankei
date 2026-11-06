import type { FuelType } from '@tankei/shared';
import { FlatList, View } from 'react-native';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { sortByPrice, type ListedStation } from '@/stations';
import { createStyles } from '@/appearance';
import { spacing } from '@/theme';
import { StationCard } from './StationCard';

interface Props {
  stations: ListedStation[];
  fuel: FuelType;
  onSelect: (station: ListedStation) => void;
  /** Posto sem preço: atalho para informar. */
  onReport?: (station: ListedStation) => void;
}

/** Postos do menor para o maior preço do combustível escolhido. */
export function StationList({ stations, fuel, onSelect, onReport }: Props) {
  const styles = useStyles();
  const bottomPadding = useBottomPadding();
  return (
    <FlatList
      data={sortByPrice(stations, fuel)}
      keyExtractor={(station) => station.id}
      contentContainerStyle={[styles.list, bottomPadding]}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => (
        <StationCard
          station={item}
          fuel={fuel}
          onPress={() => onSelect(item)}
          onReport={onReport && (() => onReport(item))}
        />
      )}
    />
  );
}

const useStyles = createStyles((colors) => ({
  list: { padding: spacing.lg },
}));
