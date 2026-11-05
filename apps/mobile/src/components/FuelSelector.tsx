import { FUEL_LABELS, type FuelType } from '@tankei/shared';
import { Pressable, ScrollView, Text } from 'react-native';
import { createStyles } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

interface Props {
  fuels: FuelType[];
  selected: FuelType;
  onSelect: (fuel: FuelType) => void;
}

export function FuelSelector({ fuels, selected, onSelect }: Props) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {fuels.map((fuel) => {
        const active = fuel === selected;
        return (
          <Pressable
            key={fuel}
            onPress={() => onSelect(fuel)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {FUEL_LABELS[fuel]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.text, fontSize: fontSize.md },
  labelActive: { color: colors.primaryText, fontWeight: '600' },
}));
