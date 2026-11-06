import { FUEL_LABELS, type FuelType } from '@tankei/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCreateAlert } from '@/api/engagement';
import { useStation } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { createStyles, useTheme } from '@/appearance';
import { FuelSelector } from '@/components/FuelSelector';
import { SignInRequired } from '@/components/SignInRequired';
import { formatPrice } from '@/format';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { useFuelPreference } from '@/hooks/useFuelPreference';
import { priceFor } from '@/stations';
import { fontSize, radius, spacing } from '@/theme';

function parse(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Criar alerta de preço do posto (ADR 0029): o aviso chega por e-mail. */
export default function CreateAlertScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useAuth();
  const station = useStation(id);
  const [preferred] = useFuelPreference();
  const [chosen, setChosen] = useState<FuelType | null>(null);
  const [text, setText] = useState('');
  const create = useCreateAlert();
  const bottomPadding = useBottomPadding();

  if (state.status !== 'signedIn') {
    return (
      <SignInRequired
        title="Entre para criar alertas"
        message="O aviso chega por e-mail, na conta com que você entrar."
      />
    );
  }
  if (!station.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const data = station.data;
  const fuel =
    chosen ?? (data.fuels.includes(preferred) ? preferred : data.fuels[0]);
  const current = fuel ? priceFor(data, fuel) : undefined;
  const value = parse(text);

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, bottomPadding]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Avisar quando baixar</Text>
      <Text style={styles.muted}>{data.name}</Text>
      {data.fuels.length > 0 && (
        <View style={styles.bleed}>
          <FuelSelector
            fuels={data.fuels}
            selected={fuel}
            onSelect={(next) => {
              setChosen(next);
              setText('');
            }}
          />
        </View>
      )}
      <Text style={styles.muted}>
        {current
          ? `Agora: R$ ${formatPrice(current.price)}.`
          : 'Ainda sem preço deste combustível.'}{' '}
        Você recebe um e-mail quando o preço ficar igual ou abaixo do valor, no
        máximo uma vez por dia.
      </Text>
      <View style={styles.inputBox}>
        <Text style={styles.currency}>R$</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={current ? formatPrice(current.price - 0.1) : '0,00'}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          autoFocus
          accessibilityLabel={`Preço máximo de ${fuel ? FUEL_LABELS[fuel].toLowerCase() : 'combustível'}`}
        />
      </View>
      {create.isError && (
        <Text style={styles.error}>{create.error.message}</Text>
      )}
      <Pressable
        style={[styles.button, (!value || create.isPending) && styles.disabled]}
        disabled={!value || create.isPending || !fuel}
        onPress={() =>
          value &&
          fuel &&
          create.mutate(
            { stationId: data.id, fuelType: fuel, maxPrice: value },
            {
              onSuccess: () =>
                Alert.alert(
                  'Alerta criado',
                  'Você recebe um e-mail quando o preço baixar. Veja e apague seus alertas em Favoritos.',
                  [{ text: 'OK', onPress: () => router.back() }],
                ),
            },
          )
        }
        accessibilityRole="button"
      >
        {create.isPending ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>Criar alerta</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { padding: spacing.xl, gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bleed: { marginHorizontal: -spacing.lg },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  currency: { color: colors.textMuted, fontSize: fontSize.xl },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    paddingVertical: spacing.sm,
  },
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
