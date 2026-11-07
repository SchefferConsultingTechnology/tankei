import {
  claimLink,
  inviteShareMessage,
  ownerWhatsappMessage,
  whatsappLink,
  type Station,
} from '@tankei/shared';
import { Linking, Pressable, Share, Text, View } from 'react-native';
import { useAppConfig } from '@/api/queries';
import { createStyles } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

/**
 * "É o responsável por este posto?" (ADR 0031): só em postos sem rede no
 * portal. Leva o responsável ao WhatsApp da equipe ou ao pedido de acesso já
 * com o posto escolhido, e deixa o consumidor indicar o posto a quem cuida
 * dele. Os textos não falam de preço nem de cobrança.
 */
export function OwnerInvite({ station }: { station: Station }) {
  const styles = useStyles();
  const config = useAppConfig();
  if (station.managed || !config.data) return null;
  const { supportWhatsapp, portalUrl } = config.data;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>É o responsável por este posto?</Text>
      <Text style={styles.body}>
        Este posto ainda não tem responsável no Tankei. Quem cuida dele pode
        manter as informações em dia, divulgar promoções e fotos e acompanhar a
        opinião dos clientes.
      </Text>
      {supportWhatsapp && (
        <Pressable
          style={styles.whatsapp}
          accessibilityRole="link"
          onPress={() =>
            void Linking.openURL(
              whatsappLink(supportWhatsapp, ownerWhatsappMessage(station)),
            )
          }
        >
          <Text style={styles.whatsappText}>Falar com a equipe no WhatsApp</Text>
        </Pressable>
      )}
      <Pressable
        style={styles.secondary}
        accessibilityRole="link"
        onPress={() =>
          void Linking.openURL(claimLink(portalUrl, station.id, 'app_dono'))
        }
      >
        <Text style={styles.secondaryText}>Pedir acesso pelo portal</Text>
      </Pressable>

      <View style={styles.invite}>
        <Text style={styles.muted}>Conhece quem cuida do posto?</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          onPress={() =>
            void Share.share({
              message: inviteShareMessage(
                station,
                claimLink(portalUrl, station.id, 'app_convite'),
              ),
            })
          }
        >
          <Text style={styles.link}>Indicar o Tankei</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  body: { color: colors.text, fontSize: fontSize.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, flexShrink: 1 },
  whatsapp: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  whatsappText: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  secondary: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  invite: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  link: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
}));
