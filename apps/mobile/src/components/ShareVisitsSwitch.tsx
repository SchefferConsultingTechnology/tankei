import { Switch, Text, View } from 'react-native';
import { createStyles, useTheme } from '@/appearance';
import { fontSize, spacing } from '@/theme';
import { useShareVisits } from '@/visits';

/** Liga ou desliga o envio das visitas anônimas aos postos (spec 0003). */
export function ShareVisitsSwitch() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { enabled, setEnabled } = useShareVisits();
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text style={styles.title}>Compartilhar estatísticas com os postos</Text>
        <Text style={styles.hint}>
          Conta, de forma anônima, quantas vezes os postos são vistos no app.
          Sem sua conta e sem sua localização: o posto vê só totais.
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
        accessibilityLabel="Compartilhar estatísticas anônimas de visitas com os postos"
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
