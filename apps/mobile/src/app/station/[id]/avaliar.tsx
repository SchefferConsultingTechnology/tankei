import {
  IQP_CRITERION_LABELS,
  IQP_DIMENSION_CRITERIA,
  IQP_DIMENSION_LABELS,
  IQP_DIMENSIONS,
  reviewResponseSchema,
  type CriterionRating,
  type IqpRatedCriterion,
  type ReviewResponse,
} from '@tankei/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useStation } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { authorizedRequest } from '@/auth/session';
import { SignInRequired } from '@/components/SignInRequired';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { createStyles, useTheme } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

/** Ausente = "não avaliei"; null = "o posto não tem" (ADR 0004). */
type Ratings = Partial<Record<IqpRatedCriterion, CriterionRating>>;

const STARS = [1, 2, 3, 4, 5] as const;

const RATING_HINTS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Péssimo',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Ótimo',
};

/** Avaliação do posto, agrupada pelas dimensões do IQP (ADR 0004). */
export default function ReviewScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useAuth();
  const station = useStation(id);
  const [ratings, setRatings] = useState<Ratings>({});
  const [priceAsAdvertised, setPriceAsAdvertised] = useState<
    boolean | null | undefined
  >(undefined);
  const bottomPadding = useBottomPadding();
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: () =>
      authorizedRequest(`/stations/${id}/reviews`, reviewResponseSchema, {
        method: 'POST',
        body: { ratings, priceAsAdvertised },
      }),
    onSuccess: (response: ReviewResponse) => {
      // O IQP é recalculado na hora: ficha, mapa e lista mudam.
      void queryClient.invalidateQueries({ queryKey: ['stations'] });
      Alert.alert('Obrigado!', response.message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
  });

  if (state.status !== 'signedIn') {
    return <SignInRequired title="Entre para avaliar postos" />;
  }

  const answered =
    Object.values(ratings).some((value) => typeof value === 'number') ||
    typeof priceAsAdvertised === 'boolean';

  function rate(criterion: IqpRatedCriterion, value: CriterionRating) {
    setRatings((current) => {
      const next = { ...current };
      // Tocar de novo na mesma opção desfaz: volta a "não avaliei".
      if (criterion in current && current[criterion] === value) {
        delete next[criterion];
      } else {
        next[criterion] = value;
      }
      return next;
    });
    submit.reset();
  }

  return (
    <ScrollView contentContainerStyle={[styles.screen, bottomPadding]}>
      <Text style={styles.title}>{station.data?.name ?? 'Avaliar posto'}</Text>
      <Text style={styles.muted}>
        Avalie só o que você viu. Se o posto não tem o item, marque “Não tem”:
        isso não baixa a nota. Preço não entra na avaliação.
      </Text>

      {IQP_DIMENSIONS.map((dimension) => (
        <View key={dimension} style={styles.section}>
          <Text style={styles.sectionTitle}>
            {IQP_DIMENSION_LABELS[dimension]}
          </Text>
          {IQP_DIMENSION_CRITERIA[dimension].map((criterion) =>
            criterion === 'preco_conforme' ? (
              <YesNoQuestion
                key={criterion}
                label={IQP_CRITERION_LABELS[criterion]}
                value={priceAsAdvertised}
                onChange={(value) => {
                  setPriceAsAdvertised(value);
                  submit.reset();
                }}
              />
            ) : (
              <RatingRow
                key={criterion}
                label={IQP_CRITERION_LABELS[criterion]}
                // Grupo de um item só: o título do grupo já diz o que é.
                showLabel={IQP_DIMENSION_CRITERIA[dimension].length > 1}
                answered={criterion in ratings}
                value={ratings[criterion as IqpRatedCriterion] ?? null}
                onRate={(value) => rate(criterion as IqpRatedCriterion, value)}
              />
            ),
          )}
        </View>
      ))}

      {submit.isError && (
        <Text style={styles.error}>{submit.error.message}</Text>
      )}
      <Pressable
        style={[
          styles.button,
          (!answered || submit.isPending) && styles.disabled,
        ]}
        disabled={!answered || submit.isPending}
        onPress={() => submit.mutate()}
        accessibilityRole="button"
      >
        {submit.isPending ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Enviar avaliação</Text>
        )}
      </Pressable>
      {!answered && (
        <Text style={[styles.muted, styles.center]}>
          Avalie ao menos um item para enviar.
        </Text>
      )}
    </ScrollView>
  );
}

function RatingRow({
  label,
  showLabel,
  answered,
  value,
  onRate,
}: {
  label: string;
  showLabel: boolean;
  answered: boolean;
  value: CriterionRating;
  onRate: (value: CriterionRating) => void;
}) {
  const styles = useStyles();
  const unavailable = answered && value === null;
  return (
    <View style={styles.criterion}>
      <View style={styles.criterionHeader}>
        <Text style={styles.body}>{showLabel ? label : ''}</Text>
        <Text style={styles.muted}>
          {value ? RATING_HINTS[value] : unavailable ? 'O posto não tem' : ''}
        </Text>
      </View>
      <View style={styles.ratingRow}>
        {STARS.map((star) => {
          const filled = value !== null && star <= value;
          return (
            <Pressable
              key={star}
              onPress={() => onRate(star)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${star} de 5`}
              accessibilityState={{ selected: value === star }}
            >
              <Text style={[styles.star, filled && styles.starFilled]}>★</Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[
            styles.chip,
            styles.pushRight,
            unavailable && styles.chipActive,
          ]}
          onPress={() => onRate(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: unavailable }}
        >
          <Text style={[styles.chipText, unavailable && styles.chipTextActive]}>
            Não tem
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function YesNoQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (value: boolean | null | undefined) => void;
}) {
  const styles = useStyles();
  const options = [
    { label: 'Sim', value: true },
    { label: 'Não', value: false },
    { label: 'Não sei', value: null },
  ] as const;
  return (
    <View style={styles.criterion}>
      <Text style={styles.body}>{label}</Text>
      <View style={styles.ratingRow}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.label}
              style={[styles.chip, active && styles.chipActive]}
              // Tocar de novo desfaz a resposta.
              onPress={() => onChange(active ? undefined : option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { padding: spacing.lg, gap: spacing.lg },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  center: { textAlign: 'center' },
  body: { color: colors.text, fontSize: fontSize.md },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  criterion: { gap: spacing.sm },
  criterionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  star: { fontSize: 32, color: colors.border },
  starFilled: { color: colors.star },
  pushRight: { marginLeft: 'auto' },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { color: colors.textMuted, fontSize: fontSize.sm },
  chipTextActive: { color: colors.surface, fontWeight: '600' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: fontSize.md },
}));
