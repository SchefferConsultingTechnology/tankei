import { useState } from 'react';
import { Text, View } from 'react-native';
import { createStyles, useTheme } from '@/appearance';
import {
  SPEED_GREEN_KMH,
  SPEED_HIDE_BELOW_KMH,
  SPEED_ORANGE_KMH,
  SPEED_RED_KMH,
  useSpeedometer,
} from '@/speedometer';
import { fontSize, radius, spacing } from '@/theme';

/**
 * Velocímetro largo acima dos filtros (ADR 0032). Número verde acima de
 * 40 km/h, laranja acima de 80 e vermelho acima de 110. Some conforme a
 * preferência em Conta.
 */
export function SpeedCard({ speedKmh }: { speedKmh: number | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { mode } = useSpeedometer();
  const [shown, setShown] = useState(false);

  // "Acima de 40": aparece acima de 40 e some abaixo de 35 (folga).
  const speed = speedKmh ?? 0;
  const next =
    speed > SPEED_GREEN_KMH
      ? true
      : speed < SPEED_HIDE_BELOW_KMH
        ? false
        : shown;
  if (next !== shown) setShown(next);

  if (mode === 'desligado') return null;
  if (mode === 'acima_40' && !next) return null;

  const rounded = speedKmh === null ? null : Math.round(speedKmh);
  const color =
    rounded === null || rounded <= SPEED_GREEN_KMH
      ? colors.text
      : rounded > SPEED_RED_KMH
        ? colors.danger
        : rounded > SPEED_ORANGE_KMH
          ? colors.accent
          : colors.success;

  return (
    <View
      style={styles.card}
      accessibilityRole="text"
      accessibilityLabel={
        rounded === null
          ? 'Velocidade ainda desconhecida'
          : `Velocidade: ${rounded} quilômetros por hora`
      }
      accessibilityLiveRegion="none"
    >
      <Text style={styles.label}>Velocidade</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{rounded ?? '--'}</Text>
        <Text style={styles.unit}>km/h</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    marginHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  label: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '600' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  value: {
    fontSize: 40,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unit: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '600' },
}));
