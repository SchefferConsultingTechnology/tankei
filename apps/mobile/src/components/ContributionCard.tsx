import {
  CONTRIBUTOR_LEVEL_DESCRIPTIONS,
  CONTRIBUTOR_LEVEL_LABELS,
  type ContributorLevel,
} from '@tankei/shared';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text, View } from 'react-native';
import { useContribution } from '@/api/engagement';
import { createStyles, useTheme } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

const ICONS: Record<ContributorLevel, SymbolViewProps['name']> = {
  iniciante: { ios: 'leaf', android: 'eco', web: 'eco' },
  colaborador: { ios: 'hand.thumbsup', android: 'thumb_up', web: 'thumb_up' },
  informante_confiavel: {
    ios: 'checkmark.seal.fill',
    android: 'verified',
    web: 'verified',
  },
};

/** Sua contribuição (ADR 0029): selo e números, vistos só pela pessoa. */
export function ContributionCard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const contribution = useContribution();
  const data = contribution.data;
  if (!data) return null;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <SymbolView
          name={ICONS[data.level]}
          size={28}
          tintColor={
            data.level === 'informante_confiavel' ? colors.primary : colors.textMuted
          }
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Sua contribuição</Text>
          <Text style={styles.level}>{CONTRIBUTOR_LEVEL_LABELS[data.level]}</Text>
        </View>
      </View>
      <Text style={styles.body}>{CONTRIBUTOR_LEVEL_DESCRIPTIONS[data.level]}</Text>
      <View style={styles.stats}>
        <Stat value={data.acceptedReports} label="preços aceitos" />
        <Stat value={data.reportsLast30Days} label="nos últimos 30 dias" />
        <Stat value={data.stationsHelped} label="postos ajudados" />
      </View>
      {data.nextLevel && (
        <Text style={styles.muted}>
          Próximo: {CONTRIBUTOR_LEVEL_LABELS[data.nextLevel.level]}.{' '}
          {data.nextLevel.missing}
        </Text>
      )}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString('pt-BR')}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { color: colors.textMuted, fontSize: fontSize.sm },
  level: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  body: { color: colors.text, fontSize: fontSize.sm },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1 },
  statValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
}));
