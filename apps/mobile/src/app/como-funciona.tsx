import {
  BADGE_DESCRIPTIONS,
  BADGE_LABELS,
  HOW_IT_WORKS,
  type PriceBadge,
} from '@tankei/shared';
import { ScrollView, Text, View } from 'react-native';
import { createStyles, useTheme } from '@/appearance';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { fontSize, radius, spacing } from '@/theme';

const BADGE_ORDER: PriceBadge[] = [
  'atualizado_posto',
  'confirmado_motoristas',
  'informado_motorista',
  'promocao',
];

/** Como funciona (ADR 0030): os mesmos textos do portal e do site. */
export default function HowItWorksScreen() {
  const styles = useStyles();
  const { badgeColors } = useTheme();
  const bottomPadding = useBottomPadding();
  const [prices, ...rest] = HOW_IT_WORKS;

  return (
    <ScrollView contentContainerStyle={[styles.screen, bottomPadding]}>
      <Section title={prices.title} paragraphs={prices.paragraphs} />

      <View style={styles.section}>
        <Text style={styles.title}>O que dizem os selos de preço</Text>
        {BADGE_ORDER.map((badge) => (
          <View key={badge} style={styles.badgeRow}>
            <View
              style={[styles.badge, { borderColor: badgeColors[badge] }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text style={[styles.badgeText, { color: badgeColors[badge] }]}>
                R$
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.badgeLabel}>{BADGE_LABELS[badge]}</Text>
              <Text style={styles.muted}>{BADGE_DESCRIPTIONS[badge]}</Text>
            </View>
          </View>
        ))}
      </View>

      {rest.map((section) => (
        <Section
          key={section.id}
          title={section.title}
          paragraphs={section.paragraphs}
        />
      ))}
    </ScrollView>
  );
}

function Section({
  title,
  paragraphs,
}: {
  title: string;
  paragraphs: readonly string[];
}) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {paragraphs.map((text) => (
        <Text key={text} style={styles.body}>
          {text}
        </Text>
      ))}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { padding: spacing.lg, gap: spacing.lg },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  body: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: fontSize.md, fontWeight: '700' },
  badgeLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
}));
