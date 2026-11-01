/**
 * Critérios do Índice de Qualidade do Posto (IQP).
 * O cálculo acontece só no backend; os clientes apenas exibem o resultado.
 * Preço não entra no IQP — tem indicador próprio.
 */
export const IQP_CRITERIA = [
  'atendimento',
  'limpeza',
  'banheiro',
  'calibrador',
  'conveniencia',
  'seguranca',
  'formas_pagamento',
] as const;

export type IqpCriterion = (typeof IQP_CRITERIA)[number];

/** Nota de 1 a 5, ou null quando o item não existe no posto ("não disponível"). */
export type CriterionRating = 1 | 2 | 3 | 4 | 5 | null;

export const IQP_METHODOLOGY_VERSION = '0.1.0';
