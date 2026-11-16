import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createStyles, useTheme } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';
import { PUMP_PATH } from './icons';

/**
 * Convite para ser o primeiro a informar o preço, no cartão do mapa e na
 * ficha, quando o posto ainda não tem preço do combustível no Tankei.
 */
export function FirstPriceInvite({
  fuelLabel,
  stationName,
  onPress,
}: {
  /** Combustível sem preço (ex.: "Gasolina comum"); sem ele, o posto todo. */
  fuelLabel?: string;
  stationName: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d={PUMP_PATH} fill={colors.accent} />
          </Svg>
        </View>
        <View style={styles.texts}>
          <Text style={styles.title}>Seja o primeiro a informar!</Text>
          <Text style={styles.body}>
            {fuelLabel
              ? `Ainda não há preço de ${fuelLabel} neste posto.`
              : 'Este posto ainda não tem preço no Tankei.'}{' '}
            Viu na bomba? O seu informe aparece para todos que passam por aqui.
          </Text>
        </View>
      </View>
      <Pressable
        style={styles.button}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Informar o preço de ${stationName}`}
      >
        <Text style={styles.buttonText}>Informar o preço</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  box: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderColor: colors.accent,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: fontSize.md },
  // Cor de ação do tema (azul no claro, laranja no escuro): o laranja de
  // destaque não tem contraste para texto no tema claro (ADR 0017).
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
}));
