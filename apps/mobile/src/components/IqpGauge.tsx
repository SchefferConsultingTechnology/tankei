import { IQP_SCALE_MAX } from '@tankei/shared';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { createStyles, useTheme } from '@/appearance';
import { fontSize } from '@/theme';

/**
 * Nota do IQP num arco de 0 a 100, com "de 100" embaixo (spec 0001): a
 * escala fica visível sem texto extra. Sem nota, trilho vazio e "—".
 */
export function IqpGauge({
  score,
  size = 88,
}: {
  score: number | null;
  size?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = ((score ?? 0) / IQP_SCALE_MAX) * circumference;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        score === null
          ? 'Índice de qualidade: dados insuficientes'
          : `Índice de qualidade ${score} de ${IQP_SCALE_MAX}`
      }
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        {score !== null && score > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.primary}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${filled} ${circumference}`}
            // O arco começa no topo e segue no sentido horário.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View
        style={styles.center}
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={[styles.score, { fontSize: size * 0.32 }]}>
          {score ?? '—'}
        </Text>
        <Text style={styles.scale}>de {IQP_SCALE_MAX}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    color: colors.text,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  scale: { color: colors.textMuted, fontSize: fontSize.sm },
}));
