import { IQP_SCALE_MAX, type IqpSummary } from '@tankei/shared';
import { Text, View } from 'react-native';
import { createStyles } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

/**
 * IQP resumido (spec 0001): "IQP 86/100", com a escala em apoio, ou "Sem
 * dados" abaixo do mínimo de avaliações.
 */
export function IqpPill({ iqp }: { iqp: IqpSummary }) {
  const styles = useStyles();
  return (
    <View
      style={styles.pill}
      accessible
      accessibilityLabel={
        iqp.score === null
          ? 'Índice de qualidade: dados insuficientes'
          : `Índice de qualidade do posto: ${iqp.score} de ${IQP_SCALE_MAX}`
      }
    >
      {iqp.score === null ? (
        <Text style={styles.text}>IQP: sem dados</Text>
      ) : (
        <Text style={styles.text}>
          IQP {iqp.score}
          <Text style={styles.scale}>/{IQP_SCALE_MAX}</Text>
        </Text>
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  pill: {
    flexShrink: 0,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  scale: { color: colors.textMuted, fontWeight: '400' },
}));
