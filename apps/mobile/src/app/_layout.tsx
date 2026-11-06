import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { PlaceProvider } from '@/place';
import {
  createStyles,
  ThemePreferenceProvider,
  useTheme,
} from '@/appearance';
import { fontSize, spacing } from '@/theme';

function HeaderActions() {
  const styles = useStyles();
  return (
    <View style={styles.headerActions}>
      <FavoritesButton />
      <AccountButton />
    </View>
  );
}

/** Favoritos e alertas (ADR 0029), ao lado da conta. */
function FavoritesButton() {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/favoritos')}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel="Favoritos e alertas"
    >
      <SymbolView
        name={{ ios: 'star', android: 'star_outline', web: 'star_outline' }}
        size={24}
        tintColor={colors.primary}
      />
    </Pressable>
  );
}

/** Atalho para a conta no cabeçalho: "Entrar", ou a foto e o primeiro nome. */
function AccountButton() {
  const styles = useStyles();
  const { state } = useAuth();
  if (state.status === 'loading') return null;
  const user = state.status === 'signedIn' ? state.user : null;
  return (
    <Pressable
      style={styles.accountButton}
      onPress={() => router.push('/conta')}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={user ? 'Sua conta' : 'Entrar'}
    >
      {user && <Avatar name={user.name} url={user.avatarUrl} size={28} />}
      <Text style={styles.account}>
        {user ? (user.name?.split(' ')[0] ?? 'Conta') : 'Entrar'}
      </Text>
    </Pressable>
  );
}

// A abertura fica até o tema salvo ser aplicado (sem piscar no tema errado).
SplashScreen.preventAutoHideAsync().catch(() => undefined);

const LOGO = {
  light: require('../../assets/brand/logo-horizontal.png'),
  dark: require('../../assets/brand/logo-horizontal-dark.png'),
};

/** Logo no lugar do título da tela inicial, na variante do tema. */
function HeaderLogo() {
  const styles = useStyles();
  const { scheme } = useTheme();
  return (
    <Image
      source={LOGO[scheme]}
      style={styles.logo}
      resizeMode="contain"
      accessibilityRole="header"
      accessibilityLabel="Tankei: postos e preços"
    />
  );
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider
      onReady={() => void SplashScreen.hideAsync().catch(() => undefined)}
    >
      <App />
    </ThemePreferenceProvider>
  );
}

function App() {
  const { colors, scheme } = useTheme();
  // Fundo da janela nativa (aparece nas transições entre telas).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Preços mudam ao longo do dia: dados de até 1 minuto são reaproveitados.
          queries: { staleTime: 60_000, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlaceProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerTintColor: colors.primary,
              headerTitleStyle: { color: colors.text },
              headerStyle: { backgroundColor: colors.surface },
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                title: 'Postos e preços',
                headerTitle: () => <HeaderLogo />,
                headerRight: () => <HeaderActions />,
              }}
            />
            <Stack.Screen name="station/[id]" options={{ title: 'Posto' }} />
            <Stack.Screen
              name="station/[id]/preco"
              options={{ title: 'Informar preço', presentation: 'modal' }}
            />
            <Stack.Screen
              name="station/[id]/avaliar"
              options={{ title: 'Avaliar posto', presentation: 'modal' }}
            />
            <Stack.Screen
              name="station/[id]/alerta"
              options={{ title: 'Alerta de preço', presentation: 'modal' }}
            />
            <Stack.Screen
              name="calculadora"
              options={{ title: 'Etanol ou gasolina?' }}
            />
            <Stack.Screen name="favoritos" options={{ title: 'Favoritos' }} />
            <Stack.Screen
              name="como-funciona"
              options={{ title: 'Como funciona' }}
            />
            <Stack.Screen
              name="cidade"
              options={{ title: 'Escolher cidade', presentation: 'modal' }}
            />
            <Stack.Screen
              name="conta"
              options={{ title: 'Conta', presentation: 'modal' }}
            />
          </Stack>
        </PlaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const useStyles = createStyles((colors) => ({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  account: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '600' },
  // Proporção do logo horizontal (720 × 212).
  logo: { height: 32, width: 32 * (720 / 212) },
}));
