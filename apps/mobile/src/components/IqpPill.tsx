import { IQP_SCALE_MAX, IQP_SUMMARY, type IqpSummary } from '@tankei/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { createStyles } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';

/**
 * IQP resumido (spec 0001): "IQP 86/100", com a escala em apoio, ou "Sem
 * dados" abaixo do mínimo de avaliações. Tocar explica o que é (ADR 0030).
 */
export function IqpPill({ iqp }: { iqp: IqpSummary }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        style={styles.pill}
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={
          iqp.score === null
            ? 'Índice de Qualidade do Posto: dados insuficientes. Toque para saber o que é'
            : `Índice de Qualidade do Posto: ${iqp.score} de ${IQP_SCALE_MAX}. Toque para saber o que é`
        }
      >
        {iqp.score === null ? (
          <Text style={styles.text}>IQP: sem dados</Text>
        ) : (
          <Text style={styles.text}>
            IQP {iqp.score}
            <Text style={styles.scale}>/{IQP_SCALE_MAX}</Text>
          </Text>
        )}
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.title}>O que é o IQP?</Text>
            <Text style={styles.body}>{IQP_SUMMARY}</Text>
            <Text style={styles.muted}>
              {iqp.score === null
                ? 'Este posto ainda tem poucas avaliações: a nota aparece quando mais pessoas diferentes avaliarem.'
                : `Este posto tem ${iqp.score} de ${IQP_SCALE_MAX}. Preço e anúncios não alteram a nota.`}
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  setOpen(false);
                  router.push('/como-funciona');
                }}
                accessibilityRole="link"
                hitSlop={6}
              >
                <Text style={styles.link}>Como funciona</Text>
              </Pressable>
              <Pressable
                style={styles.button}
                onPress={() => setOpen(false)}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>Entendi</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  pill: {
    flexShrink: 0,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  scale: { color: colors.textMuted, fontWeight: '400' },
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  body: { color: colors.text, fontSize: fontSize.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  link: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
}));
