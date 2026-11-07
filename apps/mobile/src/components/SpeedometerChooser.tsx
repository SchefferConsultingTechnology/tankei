import { Pressable, Text, View } from 'react-native';
import { createStyles } from '@/appearance';
import {
  SPEEDOMETER_MODE_LABELS,
  SPEEDOMETER_MODES,
  useSpeedometer,
} from '@/speedometer';
import { fontSize, radius, spacing } from '@/theme';

/** Preferência do velocímetro (só no aparelho). */
export function SpeedometerChooser() {
  const styles = useStyles();
  const { mode, setMode } = useSpeedometer();
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Velocímetro</Text>
      <View style={styles.track} accessibilityRole="radiogroup">
        {SPEEDOMETER_MODES.map((option) => {
          const active = option === mode;
          return (
            <Pressable
              key={option}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => setMode(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text
                style={[styles.text, active && styles.textActive]}
                numberOfLines={2}
              >
                {SPEEDOMETER_MODE_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Aparece acima dos filtros da tela inicial. Verde acima de 40 km/h,
        laranja acima de 80 e vermelho acima de 110.
      </Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  section: { gap: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  itemActive: { backgroundColor: colors.primary },
  text: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '500',
    textAlign: 'center',
  },
  textActive: { color: colors.primaryText, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: fontSize.sm },
}));
