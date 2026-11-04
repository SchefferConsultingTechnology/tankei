import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { PlaceProvider } from '@/place';
import { colors } from '@/theme';

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
      <PlaceProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Postos e preços' }} />
          <Stack.Screen name="station/[id]" options={{ title: 'Posto' }} />
          <Stack.Screen
            name="cidade"
            options={{ title: 'Escolher cidade', presentation: 'modal' }}
          />
        </Stack>
      </PlaceProvider>
    </QueryClientProvider>
  );
}
