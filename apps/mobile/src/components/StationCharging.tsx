import {
  CHARGER_ACCESS_LABELS,
  CHARGER_CURRENT_LABELS,
  CHARGER_CURRENTS,
  CHARGER_PAYMENT_LABELS,
  CONNECTOR_LABELS,
  CONNECTORS,
  suggestChargerResultSchema,
  type ChargerCurrent,
  type Connector,
  type Station,
  type StationCharger,
} from '@tankei/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { authorizedRequest } from '@/auth/session';
import { createStyles, useTheme } from '@/appearance';
import { useCarProfile, type CarProfile } from '@/hooks/useCarProfile';
import { fontSize, radius, spacing } from '@/theme';

const SOURCE_LABELS = {
  posto: 'Informado pelo posto.',
  equipe: 'Informado pela equipe Tankei.',
  usuarios: 'Informado por motoristas e confirmado por outros.',
} as const;

/** O conector do ponto serve no carro? Nulo quando não dá para saber. */
export function compatible(
  charger: Pick<StationCharger, 'connector'>,
  car: CarProfile,
): boolean | null {
  if (car.powertrain === 'combustao' || car.connectors.length === 0) return null;
  if (!charger.connector) return null;
  return car.connectors.includes(charger.connector);
}

/** "DC (rápida) · CCS2 · 60 kW · 2 pontos". */
export function describeCharger(c: StationCharger): string {
  return [
    CHARGER_CURRENT_LABELS[c.current],
    c.connector ? CONNECTOR_LABELS[c.connector] : null,
    c.powerKw ? `${c.powerKw.toLocaleString('pt-BR')} kW` : null,
    c.count ? (c.count === 1 ? '1 ponto' : `${c.count} pontos`) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Recarga elétrica na ficha do posto (ADR 0041): pontos, potência, conector,
 * acesso e pagamento. Sem cadastro do posto, o motorista pode dizer que o
 * posto tem recarga; aparece para todos depois de confirmado por outros.
 */
export function StationCharging({ station }: { station: Station }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [car] = useCarProfile();
  const charging = station.charging;
  const official = charging?.source === 'posto' || charging?.source === 'equipe';
  const ev = car.powertrain !== 'combustao';
  // Sem recarga e sem carro elétrico: só um convite discreto para informar.
  if (!charging && !ev) return <SuggestCharger station={station} compact />;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚡ Recarga elétrica</Text>
      {!charging ? (
        <Text style={styles.muted}>Ninguém informou recarga neste posto.</Text>
      ) : (
        <>
          {charging.chargers.map((c, i) => {
            const fits = compatible(c, car);
            return (
              <View key={i} style={styles.charger}>
                <Text style={styles.chargerTitle}>{describeCharger(c)}</Text>
                {fits !== null && (
                  <Text
                    style={[
                      styles.fit,
                      { color: fits ? colors.success : colors.textMuted },
                    ]}
                  >
                    {fits ? '✓ Serve no seu carro' : 'Conector diferente do seu carro'}
                  </Text>
                )}
                {c.access && (
                  <Text style={styles.detail}>{CHARGER_ACCESS_LABELS[c.access]}</Text>
                )}
                {c.payments.length > 0 && (
                  <Text style={styles.detail}>
                    {c.payments.map((p) => CHARGER_PAYMENT_LABELS[p]).join(' · ')}
                    {c.operator ? ` (${c.operator})` : ''}
                  </Text>
                )}
                {c.timeBased && (
                  <Text style={styles.detail}>
                    Cobra por tempo: consulte o preço no local.
                  </Text>
                )}
                {c.fees && <Text style={styles.detail}>{c.fees}</Text>}
              </View>
            );
          })}
          <Text style={styles.muted}>{SOURCE_LABELS[charging.source]}</Text>
        </>
      )}
      {!official && <SuggestCharger station={station} />}
    </View>
  );
}

function SuggestCharger({
  station,
  compact = false,
}: {
  station: Station;
  compact?: boolean;
}) {
  const styles = useStyles();
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ChargerCurrent | null>(null);
  const [connector, setConnector] = useState<Connector | null>(null);

  const send = useMutation({
    mutationFn: () =>
      authorizedRequest(
        `/stations/${station.id}/charging/suggestions`,
        suggestChargerResultSchema,
        {
          method: 'POST',
          body: { current, connector: connector ?? undefined },
        },
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['stations'] });
      setOpen(false);
      Alert.alert('Obrigado!', result.message);
    },
    onError: (error) =>
      Alert.alert(
        'Não foi possível enviar',
        error instanceof ApiError ? error.message : 'Tente de novo.',
      ),
  });

  const start = () => {
    if (state.status !== 'signedIn') {
      Alert.alert('Entre para informar', 'É preciso entrar para informar recarga.', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Entrar', onPress: () => router.push('/conta') },
      ]);
      return;
    }
    setOpen(true);
  };

  if (!open) {
    return (
      <Pressable
        onPress={start}
        style={compact ? styles.compactLink : undefined}
        accessibilityRole="button"
      >
        <Text style={styles.link}>
          {compact
            ? '⚡ Este posto tem recarga elétrica? Avise'
            : station.charging
              ? 'Tem outro tipo de recarga? Avise'
              : 'Este posto tem recarga? Avise'}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.form, compact && styles.section]}>
      <Text style={styles.chargerTitle}>Que recarga o posto tem?</Text>
      <View style={styles.chips}>
        {CHARGER_CURRENTS.map((c) => (
          <Chip
            key={c}
            label={CHARGER_CURRENT_LABELS[c]}
            selected={current === c}
            onPress={() => setCurrent(c)}
          />
        ))}
      </View>
      <Text style={styles.muted}>Conector (se souber)</Text>
      <View style={styles.chips}>
        {CONNECTORS.map((c) => (
          <Chip
            key={c}
            label={CONNECTOR_LABELS[c]}
            selected={connector === c}
            onPress={() => setConnector(connector === c ? null : c)}
          />
        ))}
      </View>
      <Text style={styles.muted}>
        Aparece para todos quando outro motorista confirmar. O preço por kWh
        você informa depois, em “Informar preço”.
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={() => setOpen(false)} accessibilityRole="button">
          <Text style={styles.link}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={() => send.mutate()}
          disabled={!current || send.isPending}
          style={[styles.button, (!current || send.isPending) && styles.disabled]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
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
  charger: {
    gap: 2,
    paddingBottom: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  chargerTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  fit: { fontSize: fontSize.sm, fontWeight: '700' },
  detail: { color: colors.text, fontSize: fontSize.sm },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  link: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  compactLink: { paddingVertical: spacing.xs },
  form: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  chipTextSelected: { color: colors.primaryText },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonText: { color: colors.primaryText, fontSize: fontSize.md, fontWeight: '700' },
  disabled: { opacity: 0.5 },
}));
