import type { CurrentPrice } from '@tankei/shared';
import { StyleSheet, Text, View } from 'react-native';
import { formatPrice } from '@/format';
import { badgeColors, colors, fontSize, radius, spacing } from '@/theme';

interface Props {
  price: CurrentPrice | undefined;
  size?: 'sm' | 'lg';
  /** Preenchido com a cor da origem (posto selecionado no mapa). */
  highlighted?: boolean;
}

/** Preço com a cor da origem; desatualizado fica esmaecido; sem preço, traço. */
export function PriceTag({ price, size = 'sm', highlighted = false }: Props) {
  const color = price ? badgeColors[price.badge] : colors.textMuted;
  return (
    <View
      style={[
        styles.tag,
        { borderColor: color, opacity: price?.stale ? 0.55 : 1 },
        highlighted && { backgroundColor: color },
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'lg' && styles.large,
          { color: highlighted ? colors.surface : color },
        ]}
      >
        {price ? `R$ ${formatPrice(price.price)}` : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: { fontSize: fontSize.md, fontWeight: '700' },
  large: { fontSize: fontSize.xl },
});
