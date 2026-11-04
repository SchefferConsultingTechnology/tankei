import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { PlaceProvider } from '@/place';
import { colors, fontSize, spacing } from '@/theme';

/** Atalho para a conta no cabeçalho: "Entrar", ou a foto e o primeiro nome. */
function AccountButton() {
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

export default function RootLayout() {
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
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerTintColor: colors.primary,
              headerTitleStyle: { color: colors.text },
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                title: 'Postos e preços',
                headerRight: () => <AccountButton />,
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

const styles = StyleSheet.create({
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  account: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '600' },
});
