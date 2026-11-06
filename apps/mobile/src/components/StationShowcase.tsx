import {
  FUEL_LABELS,
  type Promotion,
  type StationPhoto,
} from '@tankei/shared';
import { Image, ScrollView, Text, View } from 'react-native';
import { formatPrice, formatUntil } from '@/format';
import { createStyles } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

const PHOTO_WIDTH = 240;

/**
 * Promoções vigentes do posto, com a arte (ADR 0026). A arte aparece só na
 * ficha; a lista e o mapa mostram o selo e o nome da promoção.
 */
export function StationPromotions({ promotions }: { promotions: Promotion[] }) {
  const styles = useStyles();
  return (
    <View style={{ gap: spacing.lg }}>
      {promotions.map((p) => (
        <View key={p.id} style={styles.promotion}>
          {p.imageUrl && (
            <Image
              source={{ uri: p.imageUrl }}
              style={styles.art}
              resizeMode="cover"
              accessibilityLabel={`Arte da promoção ${p.title}`}
            />
          )}
          <View style={styles.promotionBody}>
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.until}>Promoção {formatUntil(p.endsAt)}</Text>
            {p.description && <Text style={styles.body}>{p.description}</Text>}
            {p.prices.map((price) => (
              <View key={price.fuelType} style={styles.priceRow}>
                <Text style={styles.body}>{FUEL_LABELS[price.fuelType]}</Text>
                <Text style={styles.price}>R$ {formatPrice(price.price)}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Fotos do posto em faixa com rolagem lateral (ADR 0026). */
export function StationPhotos({ photos }: { photos: StationPhoto[] }) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={PHOTO_WIDTH + spacing.md}
      decelerationRate="fast"
      contentContainerStyle={{ gap: spacing.md }}
      accessibilityLabel={`${photos.length} fotos do posto`}
    >
      {photos.map((photo) => (
        <View key={photo.id} style={{ width: PHOTO_WIDTH }}>
          <Image
            source={{ uri: photo.url }}
            style={styles.photo}
            resizeMode="cover"
            accessibilityLabel={photo.caption ?? 'Foto do posto'}
          />
          {photo.caption && (
            <Text style={styles.caption} numberOfLines={1}>
              {photo.caption}
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = createStyles((colors, badgeColors) => ({
  promotion: {
    borderColor: badgeColors.promocao,
    borderWidth: 1.5,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  art: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.surfaceAlt },
  promotionBody: { padding: spacing.md, gap: spacing.xs },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  until: {
    color: badgeColors.promocao,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  body: { color: colors.text, fontSize: fontSize.md },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  price: {
    color: badgeColors.promocao,
    fontSize: fontSize.lg,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  photo: {
    width: PHOTO_WIDTH,
    height: (PHOTO_WIDTH * 3) / 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  caption: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
}));
