/**
 * Critérios do Índice de Qualidade do Posto (IQP). Metodologia: docs/adr/0004-metodologia-iqp-v1.md.
 * O cálculo (pesos incluídos) acontece só no backend; os clientes apenas exibem o resultado.
 * Preço não entra no IQP — tem indicador próprio.
 */

/** Critérios avaliados com nota de 1 a 5. */
export const IQP_RATED_CRITERIA = [
  'atendimento',
  'limpeza',
  'banheiro',
  'calibrador',
  'conveniencia',
  'seguranca',
  'formas_pagamento',
] as const;

/** Critérios de sim/não. */
export const IQP_YES_NO_CRITERIA = ['preco_conforme'] as const;

export const IQP_CRITERIA = [...IQP_RATED_CRITERIA, ...IQP_YES_NO_CRITERIA] as const;

export type IqpRatedCriterion = (typeof IQP_RATED_CRITERIA)[number];
export type IqpYesNoCriterion = (typeof IQP_YES_NO_CRITERIA)[number];
export type IqpCriterion = (typeof IQP_CRITERIA)[number];

/** Nota de 1 a 5, ou null quando o item não existe no posto ("não disponível"). */
export type CriterionRating = 1 | 2 | 3 | 4 | 5 | null;

export const IQP_DIMENSIONS = [
  'atendimento_agilidade',
  'limpeza_infraestrutura',
  'transparencia',
  'servicos_conveniencia',
  'seguranca',
] as const;

export type IqpDimension = (typeof IQP_DIMENSIONS)[number];

/** Agrupamento usado para montar a tela de avaliação e exibir a nota por dimensão. */
export const IQP_DIMENSION_CRITERIA: Record<IqpDimension, readonly IqpCriterion[]> = {
  atendimento_agilidade: ['atendimento'],
  limpeza_infraestrutura: ['limpeza', 'banheiro'],
  transparencia: ['preco_conforme'],
  servicos_conveniencia: ['calibrador', 'conveniencia', 'formas_pagamento'],
  seguranca: ['seguranca'],
};

export const IQP_DIMENSION_LABELS: Record<IqpDimension, string> = {
  atendimento_agilidade: 'Atendimento e agilidade',
  limpeza_infraestrutura: 'Limpeza e infraestrutura',
  transparencia: 'Transparência',
  servicos_conveniencia: 'Serviços e conveniência',
  seguranca: 'Segurança',
};

/** Passa para 1.0.0 quando o cálculo do ADR 0004 for implementado. */
export const IQP_METHODOLOGY_VERSION = '0.1.0';
