import {
  priceReportResponseSchema,
  type FuelType,
  type PriceReportResponse,
} from '@tankei/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '@/api/client';
import { useStation } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { authorizedRequest } from '@/auth/session';
import { FuelSelector } from '@/components/FuelSelector';
import { describePrice } from '@/format';
import { useFuelPreference } from '@/hooks/useFuelPreference';
import { priceFor } from '@/stations';
import { colors, fontSize, radius, spacing } from '@/theme';

/** Preço como na bomba, com 3 casas: 6,299. */
const MAX_DIGITS = 5;

/** "6299" → 6.299 (a vírgula entra sozinha, como na bomba). */
function priceFromDigits(digits: string): number | null {
  return digits.length === 0 ? null : Number(digits) / 1000;
}

function formatDigits(digits: string): string {
  return (Number(digits || '0') / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
  });
}

/** Informar o preço de um combustível no posto (ADR 0003 e 0006). */
export default function ReportPriceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useAuth();
  const station = useStation(id);
  const [preferred] = useFuelPreference();
  const [chosen, setChosen] = useState<FuelType | null>(null);
  const [digits, setDigits] = useState('');
  const queryClient = useQueryClient();

  const report = useMutation({
    mutationFn: (input: {
      fuelType: FuelType;
      price: number;
      confirmed: boolean;
    }) =>
      authorizedRequest(`/stations/${id}/prices`, priceReportResponseSchema, {
        method: 'POST',
        body: input,
      }),
  });

  if (state.status !== 'signedIn') {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Entre para informar preços</Text>
        <Text style={styles.muted}>
          Cada informe fica ligado a uma conta. Isso evita abusos e dá peso aos
          preços confirmados por mais de uma pessoa.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push('/conta')}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Entrar</Text>
        </Pressable>
      </View>
    );
  }

  if (station.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (station.isError) {
    return <Text style={styles.error}>{station.error.message}</Text>;
  }

  const data = station.data;
  if (data.fuels.length === 0) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>
          Os combustíveis deste posto ainda não foram cadastrados.
        </Text>
      </View>
    );
  }

  const fuel =
    chosen ?? (data.fuels.includes(preferred) ? preferred : data.fuels[0]);
  const current = priceFor(data, fuel);
  const price = priceFromDigits(digits);

  function done(response: PriceReportResponse) {
    // Preço novo pode mudar a ficha, o mapa e a lista.
    void queryClient.invalidateQueries({ queryKey: ['stations'] });
    Alert.alert(
      response.status === 'valido' ? 'Obrigado!' : 'Preço registrado',
      response.message,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  function send(confirmed: boolean) {
    if (price === null) return;
    report.mutate(
      { fuelType: fuel, price, confirmed },
      {
        onSuccess: done,
        onError: (error) => {
          // Valor muito diferente do preço atual: pode ser erro de digitação.
          if (
            error instanceof ApiError &&
            error.code === 'CONFIRMATION_REQUIRED'
          ) {
            Alert.alert('Confira o valor', error.message, [
              { text: 'Corrigir', style: 'cancel' },
              { text: 'Está correto', onPress: () => send(true) },
            ]);
          }
        },
      },
    );
  }

  const confirmationPending =
    report.error instanceof ApiError &&
    report.error.code === 'CONFIRMATION_REQUIRED';

  const canSend = price !== null && !report.isPending;
  return (
    // O botão fica logo abaixo do campo, para caber acima do teclado; a tecla
    // "OK" do teclado também envia.
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{data.name}</Text>
      <View style={styles.bleed}>
        <FuelSelector
          fuels={data.fuels}
          selected={fuel}
          onSelect={(next) => {
            setChosen(next);
            report.reset();
          }}
        />
      </View>
      <Text style={styles.muted}>
        {current
          ? `Preço atual: R$ ${current.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} · ${describePrice(current)}`
          : 'Ainda sem preço informado.'}
      </Text>

      <View>
        <Text style={styles.label}>Preço na bomba</Text>
        <Text style={styles.muted}>
          Digite os números como na bomba, com as três casas decimais.
        </Text>
      </View>
      <View style={styles.priceBox}>
        <Text style={styles.currency}>R$</Text>
        <TextInput
          style={styles.priceInput}
          value={digits ? formatDigits(digits) : ''}
          onChangeText={(text) => {
            setDigits(
              text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS),
            );
            report.reset();
          }}
          onSubmitEditing={() => canSend && send(false)}
          placeholder="0,000"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          returnKeyType="send"
          autoFocus
          accessibilityLabel="Preço por litro"
        />
        <Text style={styles.unit}>{fuel === 'gnv' ? '/m³' : '/litro'}</Text>
      </View>

      {report.isError && !confirmationPending && (
        <Text style={styles.error}>{report.error.message}</Text>
      )}
      <Pressable
        style={[styles.button, !canSend && styles.disabled]}
        disabled={!canSend}
        onPress={() => send(false)}
        accessibilityRole="button"
      >
        {report.isPending ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Enviar preço</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.xl, gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // O seletor já tem recuo lateral próprio: os chips alinham com o texto.
  bleed: { marginHorizontal: -spacing.lg },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  label: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  currency: { color: colors.textMuted, fontSize: fontSize.xl },
  priceInput: {
    flex: 1,
    color: colors.text,
    fontSize: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.sm,
  },
  unit: { color: colors.textMuted, fontSize: fontSize.md },
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
});
