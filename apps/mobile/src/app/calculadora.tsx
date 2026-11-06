import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { createStyles, useTheme } from '@/appearance';
import { chooseFuel, ETHANOL_RULE_RATIO } from '@/fuel-economy';
import { formatPrice } from '@/format';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { useCarProfile } from '@/hooks/useCarProfile';
import { fontSize, radius, spacing } from '@/theme';

function parse(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Etanol ou gasolina? (ADR 0029). Com o consumo do carro, compara o custo por
 * km; sem ele, usa a regra dos 70%. Os preços vêm do posto, se aberto da
 * ficha, e podem ser editados.
 */
export default function CalculatorScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ etanol?: string; gasolina?: string }>();
  const [car] = useCarProfile();
  const [ethanol, setEthanol] = useState(
    params.etanol ? formatPrice(Number(params.etanol)) : '',
  );
  const [gasoline, setGasoline] = useState(
    params.gasolina ? formatPrice(Number(params.gasolina)) : '',
  );
  const bottomPadding = useBottomPadding();

  const e = parse(ethanol);
  const g = parse(gasoline);
  const consumption =
    car.kmPerLiterEthanol && car.kmPerLiterGasoline
      ? { etanol: car.kmPerLiterEthanol, gasolina: car.kmPerLiterGasoline }
      : null;
  const result = e && g ? chooseFuel(e, g, car.tankLiters, consumption) : null;

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, bottomPadding]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.muted}>
        {consumption
          ? `Usando o consumo do seu carro: ${consumption.etanol} km/l com etanol e ${consumption.gasolina} km/l com gasolina.`
          : `Regra prática: o etanol compensa quando custa até ${Math.round(ETHANOL_RULE_RATIO * 100)}% do preço da gasolina. Informe o consumo do seu carro em Conta › Meu carro para uma conta mais precisa.`}
      </Text>

      <View style={styles.row}>
        <PriceField label="Etanol" value={ethanol} onChange={setEthanol} />
        <PriceField label="Gasolina" value={gasoline} onChange={setGasoline} />
      </View>

      {result && (
        <View
          style={[
            styles.result,
            {
              borderColor:
                result.best === 'empate' ? colors.border : colors.primary,
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.verdict}>
            {result.best === 'empate'
              ? 'Tanto faz: o custo é praticamente o mesmo.'
              : result.best === 'etanol'
                ? 'Compensa abastecer com etanol'
                : 'Compensa abastecer com gasolina'}
          </Text>
          <Text style={styles.body}>
            O etanol custa {Math.round(result.ratio * 100)}% do preço da
            gasolina (limite: {Math.round(result.threshold * 100)}%).
          </Text>
          {result.costPerKm && (
            <Text style={styles.body}>
              Por km: etanol {money(result.costPerKm.etanol)}, gasolina{' '}
              {money(result.costPerKm.gasolina)}.
            </Text>
          )}
          {result.best !== 'empate' && (
            <Text style={styles.savings}>
              Economia de cerca de {money(result.savingsPerTank)} na distância
              de um tanque de {car.tankLiters} L.
            </Text>
          )}
        </View>
      )}

      <Pressable onPress={() => router.push('/conta')} accessibilityRole="link">
        <Text style={styles.link}>Ajustar tanque e consumo em Meu carro</Text>
      </Pressable>
    </ScrollView>
  );
}

function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <Text style={styles.currency}>R$</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="0,00"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          accessibilityLabel={`Preço do ${label.toLowerCase()}`}
        />
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { padding: spacing.xl, gap: spacing.lg },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  body: { color: colors.text, fontSize: fontSize.md },
  row: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1, gap: spacing.xs },
  label: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  currency: { color: colors.textMuted, fontSize: fontSize.md },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    paddingVertical: spacing.sm,
  },
  result: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  verdict: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  savings: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  link: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
}));
