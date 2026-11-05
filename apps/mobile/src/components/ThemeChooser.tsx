import { Pressable, Text, View } from 'react-native';
import {
  createStyles,
  useThemePreference,
  type ThemePreference,
} from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

/** Tema do app: seguir o celular (padrão), claro ou escuro. */
export function ThemeChooser() {
  const styles = useStyles();
  const { preference, setPreference } = useThemePreference();
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Aparência</Text>
      <View style={styles.track} accessibilityRole="radiogroup">
        {OPTIONS.map((option) => {
          const active = option.value === preference;
          return (
            <Pressable
              key={option.value}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => setPreference(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.text, active && styles.textActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        No automático, o app segue o tema claro ou escuro do celular.
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
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  itemActive: { backgroundColor: colors.primary },
  text: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '500' },
  textActive: { color: colors.primaryText, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: fontSize.sm },
}));
