import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/theme';

/**
 * Espaço no fim das telas com rolagem. Com a tela de ponta a ponta do
 * Android, o conteúdo passa por baixo da barra de navegação do sistema.
 */
export function useBottomPadding(extra: number = spacing.lg) {
  return { paddingBottom: useSafeAreaInsets().bottom + extra };
}
