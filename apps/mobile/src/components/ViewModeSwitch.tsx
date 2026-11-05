import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { createStyles, useTheme } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

export type ViewMode = 'mapa' | 'lista';

const OPTIONS: {
  mode: ViewMode;
  label: string;
  icon: SymbolViewProps['name'];
}[] = [
  { mode: 'mapa', label: 'Mapa', icon: { ios: 'map', android: 'map' } },
  {
    mode: 'lista',
    label: 'Lista (menor preço)',
    icon: { ios: 'list.bullet', android: 'format_list_bulleted' },
  },
];

interface Props {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

/**
 * Mapa ou lista: controle segmentado com contorno, ícone em cada opção e a
 * escolhida preenchida com a cor de ação (deixa claro que é um ou outro).
 */
export function ViewModeSwitch({ mode, onChange }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {OPTIONS.map((option) => {
        const active = option.mode === mode;
        const color = active ? colors.primaryText : colors.textMuted;
        return (
          <Pressable
            key={option.mode}
            onPress={() => onChange(option.mode)}
            style={[styles.item, active && styles.itemActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <SymbolView name={option.icon} size={18} tintColor={color} />
            <Text
              style={[styles.text, active && styles.textActive]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  track: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  itemActive: { backgroundColor: colors.primary },
  text: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '500' },
  textActive: { color: colors.primaryText, fontWeight: '700' },
}));
