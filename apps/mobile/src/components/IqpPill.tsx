import type { IqpSummary } from '@tankei/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/theme';

/** IQP resumido: nota de 0 a 100, ou "Sem dados" abaixo do mínimo de avaliações. */
export function IqpPill({ iqp }: { iqp: IqpSummary }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>
        {iqp.score === null ? 'IQP: sem dados' : `IQP ${iqp.score}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
});
