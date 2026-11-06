import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { createStyles, useTheme } from '@/appearance';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { fontSize, radius, spacing } from '@/theme';

const LOGO = {
  light: require('../../assets/brand/logo-horizontal.png'),
  dark: require('../../assets/brand/logo-horizontal-dark.png'),
};

const COMPANY = 'Scheffer Consultoria';
const COMPANY_SITE = 'https://scheffer.solutions';
const CONTACT_EMAIL = 'scheffer.consulting.technology@gmail.com';
const FIRST_YEAR = 2026;

/** Versão do app (app.json), com o número do build no Android. */
function appVersion(): string {
  const config = Constants.expoConfig;
  const version = config?.version ?? '—';
  const build = config?.android?.versionCode;
  return build ? `${version} (build ${build})` : version;
}

/** Sobre o Tankei: versão, o que é, contato e direitos autorais. */
export default function AboutScreen() {
  const styles = useStyles();
  const { scheme } = useTheme();
  const bottomPadding = useBottomPadding();
  const year = new Date().getFullYear();
  const api = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(
    /^https?:\/\/([^/]+).*$/,
    '$1',
  );

  return (
    <ScrollView contentContainerStyle={[styles.screen, bottomPadding]}>
      <View style={styles.hero}>
        <Image
          source={LOGO[scheme]}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Tankei"
        />
        <Text style={styles.tagline}>Postos e preços de combustível</Text>
        <Text style={styles.version}>Versão {appVersion()}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.body}>
          O Tankei mostra os preços dos postos perto de você, informados pelos
          próprios postos e por consumidores, e o Índice de Qualidade do Posto
          (IQP), calculado a partir das avaliações de quem abastece.
        </Text>
        <Text style={styles.body}>
          Preço e anúncios não alteram a nota dos postos nem a ordem por menor
          preço.
        </Text>
        <Pressable
          onPress={() => router.push('/como-funciona')}
          accessibilityRole="link"
          hitSlop={6}
        >
          <Text style={styles.link}>Como funciona</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Row label="Versão" value={appVersion()} />
        <Row label="Servidor" value={api || '—'} />
        <Row label="Contato" value={CONTACT_EMAIL}>
          <Pressable
            onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            accessibilityRole="link"
            accessibilityLabel={`Escrever para ${CONTACT_EMAIL}`}
          >
            <Text style={styles.linkSmall}>{CONTACT_EMAIL}</Text>
          </Pressable>
        </Row>
      </View>

      <View style={styles.footer}>
        <Text style={styles.copyright}>
          © {year > FIRST_YEAR ? `${FIRST_YEAR}–${year}` : year} {COMPANY}.
          Todos os direitos reservados.
        </Text>
        <Pressable
          onPress={() => void Linking.openURL(COMPANY_SITE)}
          accessibilityRole="link"
          accessibilityLabel={`Site da ${COMPANY}`}
          hitSlop={6}
        >
          <Text style={styles.link}>{COMPANY_SITE.replace('https://', '')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children ?? (
        <Text style={styles.rowValue} selectable>
          {value}
        </Text>
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { padding: spacing.lg, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  logo: { width: 220, height: 64 },
  tagline: { color: colors.textMuted, fontSize: fontSize.md },
  version: { color: colors.textMuted, fontSize: fontSize.sm },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  body: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
  link: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  linkSmall: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: { color: colors.textMuted, fontSize: fontSize.sm },
  rowValue: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  footer: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  copyright: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
}));
