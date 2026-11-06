import { FUEL_LABELS, type PriceAlert } from '@tankei/shared';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useAlerts, useFavorites, useRemoveAlert } from '@/api/engagement';
import { useAuth } from '@/auth/AuthProvider';
import { createStyles, useTheme } from '@/appearance';
import { SignInRequired } from '@/components/SignInRequired';
import { StationCard } from '@/components/StationCard';
import { formatPrice } from '@/format';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { useFuelPreference } from '@/hooks/useFuelPreference';
import { fontSize, radius, spacing } from '@/theme';

/** Postos favoritos e alertas de preço (ADR 0029). */
export default function FavoritesScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { state } = useAuth();
  const [fuel] = useFuelPreference();
  const favorites = useFavorites();
  const alerts = useAlerts();
  const bottomPadding = useBottomPadding();

  if (state.status !== 'signedIn') {
    return (
      <SignInRequired
        title="Entre para ter favoritos e alertas"
        message="Com a conta você guarda seus postos e recebe um e-mail quando o preço baixar do valor que escolher."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.screen, bottomPadding]}>
      <Text style={styles.sectionTitle}>Alertas de preço</Text>
      {alerts.isPending && <ActivityIndicator color={colors.primary} />}
      {alerts.data?.length === 0 && (
        <Text style={styles.muted}>
          Nenhum alerta. Na ficha de um posto, toque em “Avisar quando baixar”.
          O aviso chega por e-mail.
        </Text>
      )}
      {alerts.data?.map((alert) => <AlertRow key={alert.id} alert={alert} />)}

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
        Postos favoritos
      </Text>
      {favorites.isPending && <ActivityIndicator color={colors.primary} />}
      {favorites.data?.length === 0 && (
        <Text style={styles.muted}>
          Nenhum favorito. Na ficha de um posto, toque na estrela.
        </Text>
      )}
      {favorites.data?.map((station) => (
        <StationCard
          key={station.id}
          station={station}
          fuel={fuel}
          onPress={() =>
            router.push({ pathname: '/station/[id]', params: { id: station.id } })
          }
        />
      ))}
    </ScrollView>
  );
}

function AlertRow({ alert }: { alert: PriceAlert }) {
  const styles = useStyles();
  const remove = useRemoveAlert();
  const reached =
    alert.currentPrice !== null && alert.currentPrice <= alert.maxPrice;
  return (
    <View style={styles.alert}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.alertTitle} numberOfLines={1}>
          {alert.station.name}
        </Text>
        <Text style={styles.muted}>
          {FUEL_LABELS[alert.fuelType]} até R$ {formatPrice(alert.maxPrice)}
          {alert.currentPrice !== null
            ? ` · agora R$ ${formatPrice(alert.currentPrice)}`
            : ' · sem preço agora'}
        </Text>
        {reached && <Text style={styles.reached}>Preço dentro do alerta</Text>}
      </View>
      <Pressable
        onPress={() =>
          Alert.alert('Apagar alerta?', alert.station.name, [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Apagar',
              style: 'destructive',
              onPress: () => remove.mutate(alert.id),
            },
          ])
        }
        accessibilityRole="button"
        accessibilityLabel={`Apagar alerta de ${alert.station.name}`}
        hitSlop={8}
      >
        <Text style={styles.remove}>Apagar</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  alertTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  reached: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  remove: { color: colors.danger, fontSize: fontSize.md, fontWeight: '600' },
}));
