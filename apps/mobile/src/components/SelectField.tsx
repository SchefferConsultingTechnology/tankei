import { Pressable, Text, View } from 'react-native';
import { createStyles } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

interface Props {
  label: string;
  value: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** Campo de escolha (rótulo, valor e seta), com cara de botão. */
export function SelectField({ label, value, onPress, accessibilityLabel }: Props) {
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.arrow}>▾</Text>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  field: {
    flex: 1,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { borderColor: colors.primary },
  label: { color: colors.textMuted, fontSize: fontSize.sm },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  value: {
    flexShrink: 1,
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  arrow: { color: colors.primary, fontSize: fontSize.lg },
}));
