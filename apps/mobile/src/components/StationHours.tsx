import {
  DAY_TYPE_LABELS,
  DAY_TYPES,
  dayTypeOf,
  describeDay,
  openingStatus,
  STATION_SERVICE_LABELS,
  type Station,
} from '@tankei/shared';
import { Text, View } from 'react-native';
import { createStyles, useTheme } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

/** Tipo de dia de hoje no aparelho (para destacar a linha). */
function todayType() {
  const now = new Date();
  return dayTypeOf({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    weekday: now.getDay(),
  });
}

/**
 * Horário de atendimento e serviços na ficha do posto (ADR 0033). Some se o
 * posto não informou nada.
 */
export function StationHours({ station }: { station: Station }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { hours, services } = station;
  if (!hours && services.length === 0) return null;
  const status = openingStatus(hours, station.state);
  const today = todayType();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Horário e serviços</Text>
      {status && (
        <Text
          style={[
            styles.status,
            { color: status.open ? colors.success : colors.danger },
          ]}
        >
          {status.label}
        </Text>
      )}
      {hours &&
        DAY_TYPES.map((day) => (
          <View key={day} style={styles.row}>
            <Text style={[styles.day, day === today && styles.today]}>
              {DAY_TYPE_LABELS[day]}
            </Text>
            <Text style={[styles.value, day === today && styles.today]}>
              {describeDay(hours[day])}
            </Text>
          </View>
        ))}
      {hours && (
        <Text style={styles.muted}>Feriados nacionais.</Text>
      )}
      {services.length > 0 && (
        <Text style={styles.services}>
          Serviços: {services.map((s) => STATION_SERVICE_LABELS[s]).join(' · ')}
        </Text>
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  status: { fontSize: fontSize.md, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  day: { color: colors.textMuted, fontSize: fontSize.md },
  value: { color: colors.text, fontSize: fontSize.md, textAlign: 'right', flexShrink: 1 },
  today: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  services: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
}));
