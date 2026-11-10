import { CONNECTOR_LABELS, CONNECTORS, type Connector } from '@tankei/shared';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { createStyles, useTheme } from '@/appearance';
import {
  POWERTRAIN_LABELS,
  POWERTRAINS,
  useCarProfile,
  type CarProfile,
} from '@/hooks/useCarProfile';
import { fontSize, radius, spacing } from '@/theme';

function parse(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const show = (value: number | null) =>
  value === null ? '' : String(value).replace('.', ',');

/**
 * Meu carro (ADR 0029): tanque e consumo, guardados só no aparelho. Usados na
 * calculadora etanol x gasolina e no "vale a pena ir até lá?".
 */
export function CarProfileForm() {
  const [car, setCar] = useCarProfile();
  // Recria o formulário quando o perfil salvo carrega ou muda.
  return <Form key={JSON.stringify(car)} car={car} setCar={setCar} />;
}

function Form({
  car,
  setCar,
}: {
  car: CarProfile;
  setCar: (car: CarProfile) => void;
}) {
  const styles = useStyles();
  const [tank, setTank] = useState(show(car.tankLiters));
  const [gasoline, setGasoline] = useState(show(car.kmPerLiterGasoline));
  const [ethanol, setEthanol] = useState(show(car.kmPerLiterEthanol));

  function save(next: { tank?: string; gasoline?: string; ethanol?: string }) {
    const t = parse(next.tank ?? tank);
    setCar({
      ...car,
      tankLiters: t !== null && t <= 200 ? Math.round(t) : car.tankLiters,
      kmPerLiterGasoline: parse(next.gasoline ?? gasoline),
      kmPerLiterEthanol: parse(next.ethanol ?? ethanol),
    });
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Meu carro</Text>
      <Text style={styles.muted}>
        Fica só neste aparelho. Usado na calculadora etanol x gasolina, no
        “vale a pena ir até lá?” e para destacar a recarga compatível.
      </Text>
      <View style={styles.chips}>
        {POWERTRAINS.map((p) => (
          <Chip
            key={p}
            label={POWERTRAIN_LABELS[p]}
            selected={car.powertrain === p}
            onPress={() => setCar({ ...car, powertrain: p })}
          />
        ))}
      </View>
      {car.powertrain !== 'combustao' && (
        <>
          <Text style={styles.label}>Conectores de recarga do carro</Text>
          <View style={styles.chips}>
            {CONNECTORS.map((c) => (
              <Chip
                key={c}
                label={CONNECTOR_LABELS[c]}
                selected={car.connectors.includes(c)}
                onPress={() => setCar({ ...car, connectors: toggle(car.connectors, c) })}
              />
            ))}
          </View>
          <Text style={styles.muted}>
            Na dúvida: Tipo 2 é a tomada da recarga lenta (AC) e CCS2 a da
            rápida (DC) na maioria dos carros vendidos no Brasil.
          </Text>
        </>
      )}
      {car.powertrain !== 'eletrico' && (
      <View style={styles.row}>
        <Field
          label="Tanque (L)"
          value={tank}
          onChange={setTank}
          onDone={() => save({})}
        />
        <Field
          label="Gasolina (km/l)"
          value={gasoline}
          placeholder="opcional"
          onChange={setGasoline}
          onDone={() => save({})}
        />
        <Field
          label="Etanol (km/l)"
          value={ethanol}
          placeholder="opcional"
          onChange={setEthanol}
          onDone={() => save({})}
        />
      </View>
      )}
    </View>
  );
}

function toggle(list: Connector[], c: Connector): Connector[] {
  return list.includes(c) ? list.filter((x) => x !== c) : [...list, c];
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

function Field({
  label,
  value,
  placeholder,
  onChange,
  onDone,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onDone: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        onEndEditing={onDone}
        onBlur={onDone}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  box: { alignSelf: 'stretch', gap: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
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
  field: { flex: 1, gap: 2 },
  label: { color: colors.textMuted, fontSize: fontSize.sm },
  input: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
}));
