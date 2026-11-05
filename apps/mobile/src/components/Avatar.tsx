import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { createStyles } from '@/appearance';

interface Props {
  name: string | null;
  url: string | null;
  size: number;
}

/** Foto da conta; sem foto, ou se ela não carregar, a inicial do nome. */
export function Avatar({ name, url, size }: Props) {
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.image, shape]}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.fallback, shape]}>
      <Text style={[styles.initial, { fontSize: size * 0.45 }]}>
        {name?.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  image: { backgroundColor: colors.border },
  fallback: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: colors.primaryText, fontWeight: '700' },
}));
