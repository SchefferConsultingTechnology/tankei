import type { PriceBadge } from './price';
import { IQP_EXPLANATION } from './iqp';

/**
 * Textos de "Como funciona" (ADR 0030), iguais no app, no portal e no site:
 * o que significam o IQP, os selos de preço, o aviso de divergência, as
 * promoções e a contribuição de quem informa.
 */

/** O que cada selo de preço quer dizer (ADR 0003 e 0020). */
export const BADGE_DESCRIPTIONS: Record<PriceBadge, string> = {
  atualizado_posto: 'O próprio posto informou o preço no portal do Tankei.',
  confirmado_motoristas:
    'Pessoas diferentes informaram o mesmo valor. Quem estava no posto e tem histórico confiável conta mais.',
  informado_motorista:
    'Uma pessoa informou o preço e ainda não houve confirmação.',
  promocao: 'Preço promocional do posto, válido até a data indicada.',
};

export interface HelpSection {
  id: string;
  title: string;
  paragraphs: readonly string[];
}

export const HOW_IT_WORKS: readonly HelpSection[] = [
  {
    id: 'precos',
    title: 'De onde vêm os preços',
    paragraphs: [
      'Os preços são informados pelos próprios postos, no portal do Tankei, e por consumidores, no app. Cada preço mostra a origem e há quanto tempo foi informado.',
      'Preço sem informe novo há alguns dias aparece como desatualizado e, depois de mais tempo, deixa de ser exibido.',
      'A média da ANP serve de referência: valores muito fora dela pedem confirmação ou não são aceitos.',
    ],
  },
  {
    id: 'divergencia',
    title: '“Consumidores informaram outro valor”',
    paragraphs: [
      'Quando consumidores confirmam um valor diferente do preço do posto, o app continua mostrando o preço do posto, com esse aviso. O posto tem um prazo para reconfirmar ou contestar; sem resposta, passa a valer o valor dos consumidores.',
      'O posto não apaga informes. Uma contestação é analisada pela equipe Tankei, que mantém ou anula os informes.',
    ],
  },
  {
    id: 'iqp',
    title: 'IQP: Índice de Qualidade do Posto',
    paragraphs: IQP_EXPLANATION,
  },
  {
    id: 'promocoes',
    title: 'Promoções',
    paragraphs: [
      'Promoções são cadastradas pelo posto, com período e, às vezes, preço promocional. Aparecem com uma faixa na lista e no mapa, e com a arte na ficha do posto.',
      'Promoção e anúncio não mudam a ordem por menor preço nem a nota do posto.',
    ],
  },
  {
    id: 'contribuicao',
    title: 'Quem informa preços',
    paragraphs: [
      'Para evitar abusos, o informe de uma conta muito nova ou sem histórico aparece, mas não confirma o de outra pessoa. Quem está no posto ao informar tem mais peso.',
      'O Tankei guarda só se você estava ou não no posto, nunca a sua localização.',
    ],
  },
];
