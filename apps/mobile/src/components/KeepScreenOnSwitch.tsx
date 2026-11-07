import { Switch, Text, View } from 'react-native';
import { createStyles, useTheme } from '@/appearance';
import { useKeepScreenOn } from '@/keep-awake';
import { fontSize, spacing } from '@/theme';

/** Liga ou desliga a tela sempre acesa com o app aberto. */
export function KeepScreenOnSwitch() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { enabled, setEnabled } = useKeepScreenOn();
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text style={styles.title}>Manter a tela ligada</Text>
        <Text style={styles.hint}>
          Com o app aberto, a tela não apaga, como no Maps e no Waze. Gasta um
          pouco mais de bateria.
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
        accessibilityLabel="Manter a tela ligada com o app aberto"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texts: { flex: 1, gap: spacing.xs },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: fontSize.sm },
}));
