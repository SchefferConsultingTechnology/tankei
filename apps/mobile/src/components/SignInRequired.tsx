import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@/theme';

/** Tela de ação que exige conta: explica o motivo e leva ao login. */
export function SignInRequired({ title }: { title: string }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>
        Cada contribuição fica ligada a uma conta. Isso evita abusos e dá peso
        ao que é confirmado por mais de uma pessoa.
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

const styles = StyleSheet.create({
  screen: { padding: spacing.xl, gap: spacing.md },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: fontSize.md },
  button: {
    marginTop: spacing.lg,
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
});
