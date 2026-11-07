import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { googleErrorMessage } from '@/auth/google';
import { Avatar } from '@/components/Avatar';
import { CarProfileForm } from '@/components/CarProfileForm';
import { ContributionCard } from '@/components/ContributionCard';
import { KeepScreenOnSwitch } from '@/components/KeepScreenOnSwitch';
import { SpeedometerChooser } from '@/components/SpeedometerChooser';
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
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
      >
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
          <CarProfileForm />
        </View>
        <HowItWorksLink />
        <View style={styles.appearance}>
          <ThemeChooser />
        </View>
        <View style={styles.appearance}>
          <KeepScreenOnSwitch />
        </View>
        <View style={styles.appearance}>
          <SpeedometerChooser />
        </View>
      </ScrollView>
    );
  }

  const { user } = state;
  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <Avatar name={user.name} url={user.avatarUrl} size={72} />
      <Text style={styles.title}>{user.name ?? 'Sua conta'}</Text>
      {user.email && <Text style={styles.muted}>{user.email}</Text>}
      {user.managedStations.length > 0 && (
        <Text style={styles.muted}>
          Gestor de: {user.managedStations.map((s) => s.name).join(', ')}
        </Text>
      )}
      <ContributionCard />
      <Pressable
        style={styles.link}
        onPress={() => router.push('/favoritos')}
        accessibilityRole="button"
      >
        <Text style={styles.linkText}>Favoritos e alertas de preço</Text>
      </Pressable>
      <View style={styles.appearance}>
        <CarProfileForm />
      </View>
      <Pressable
        style={[styles.buttonOutline, busy && styles.disabled]}
        disabled={busy}
        onPress={() => void run(signOut)}
        accessibilityRole="button"
      >
        <Text style={styles.buttonOutlineText}>Sair</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <HowItWorksLink />
      <View style={styles.appearance}>
        <ThemeChooser />
      </View>
      <View style={styles.appearance}>
        <KeepScreenOnSwitch />
      </View>
      <View style={styles.appearance}>
        <SpeedometerChooser />
      </View>
    </ScrollView>
  );
}

function HowItWorksLink() {
  const styles = useStyles();
  return (
    <Pressable
      style={styles.link}
      onPress={() => router.push('/como-funciona')}
      accessibilityRole="button"
    >
      <Text style={styles.linkText}>Como funciona o Tankei</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { padding: spacing.xl, gap: spacing.md },
  link: { paddingVertical: spacing.xs },
  linkText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
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
