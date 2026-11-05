import { FUEL_LABELS, type FuelType } from '@tankei/shared';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useBottomPadding } from '@/hooks/useBottomPadding';
import { createStyles } from '@/appearance';
import { fontSize, radius, spacing } from '@/theme';
import { SelectField } from './SelectField';

interface Props {
  fuels: FuelType[];
  selected: FuelType;
  onSelect: (fuel: FuelType) => void;
}

/**
 * Combustível em um campo compacto; o toque abre um painel com todas as
 * opções visíveis de uma vez (sem rolagem lateral escondendo opções).
 */
export function FuelPicker({ fuels, selected, onSelect }: Props) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const bottomPadding = useBottomPadding();

  return (
    <>
      <SelectField
        label="Combustível"
        value={FUEL_LABELS[selected]}
        onPress={() => setOpen(true)}
        accessibilityLabel={`Combustível: ${FUEL_LABELS[selected]}. Trocar`}
      />
      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Fechar"
        />
        <View style={[styles.sheet, bottomPadding]}>
          <Text style={styles.title}>Combustível</Text>
          {fuels.map((fuel) => {
            const active = fuel === selected;
            return (
              <Pressable
                key={fuel}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => {
                  onSelect(fuel);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Text style={[styles.label, active && styles.labelActive]}>
                  {FUEL_LABELS[fuel]}
                </Text>
                {active && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.text, fontSize: fontSize.lg },
  labelActive: { color: colors.primaryText, fontWeight: '600' },
  check: { color: colors.primaryText, fontSize: fontSize.lg, fontWeight: '700' },
}));
