import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { googleErrorMessage } from '@/auth/google';
import { Avatar } from '@/components/Avatar';
import { ThemeChooser } from '@/components/ThemeChooser';
import { createStyles, useTheme } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

/** Entrar com Google, ou ver a conta e sair (ADR 0007). */
export default function AccountScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { state, signInWithGoogle, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(googleErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (state.status === 'signedOut') {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Entre na sua conta</Text>
        <Text style={styles.muted}>
          Com a conta você informa preços e avalia os postos. Para consultar
          preços, não é preciso entrar.
        </Text>
        <Pressable
          style={[styles.button, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void run(signInWithGoogle)}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.buttonText}>Entrar com Google</Text>
          )}
        </Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.appearance}>
          <ThemeChooser />
        </View>
      </View>
    );
  }

  const { user } = state;
  return (
    <View style={styles.screen}>
      <Avatar name={user.name} url={user.avatarUrl} size={72} />
      <Text style={styles.title}>{user.name ?? 'Sua conta'}</Text>
      {user.email && <Text style={styles.muted}>{user.email}</Text>}
      {user.managedStations.length > 0 && (
        <Text style={styles.muted}>
          Gestor de: {user.managedStations.map((s) => s.name).join(', ')}
        </Text>
      )}
      <Pressable
        style={[styles.buttonOutline, busy && styles.disabled]}
        disabled={busy}
        onPress={() => void run(signOut)}
        accessibilityRole="button"
      >
        <Text style={styles.buttonOutlineText}>Sair</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.appearance}>
        <ThemeChooser />
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, padding: spacing.xl, gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '700' },
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
  buttonOutline: {
    marginTop: spacing.lg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonOutlineText: {
    color: colors.danger,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  disabled: { opacity: 0.6 },
  error: { color: colors.danger, fontSize: fontSize.md },
  // Separada da conta: vale com ou sem login.
  appearance: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    alignSelf: 'stretch',
  },
}));
