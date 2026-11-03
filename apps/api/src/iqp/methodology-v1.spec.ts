import type { ReviewAnswers } from '../database/schema/reviews';
import {
  computeCityPrior,
  computeIqp,
  type ReviewInput,
} from './methodology-v1';

const now = new Date('2026-11-03T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

function review(
  userId: string,
  answers: ReviewAnswers,
  ageDays = 0,
  stationId = 'posto',
): ReviewInput {
  return { stationId, userId, answers, createdAt: daysAgo(ageDays) };
}

/** As mesmas respostas, de pessoas diferentes. */
const people = (count: number, answers: ReviewAnswers) =>
  Array.from({ length: count }, (_, i) => review(`p${i}`, answers));

describe('computeIqp (metodologia 1.0.0)', () => {
  it('três notas máximas, sem histórico na cidade: puxada para o neutro (68,75, não 100)', () => {
    // (5 × 50 + 3 × 100) / (5 + 3) = 68,75
    const result = computeIqp(people(3, { atendimento: 5 }), {}, now);

    expect(result).toMatchObject({
      score: 68.75,
      confidence: 'baixa',
      reviewers: 3,
      effectiveReviews: 3,
    });
    expect(result.dimensions.atendimento_agilidade).toEqual({
      score: 68.75,
      weight: 30,
    });
  });

  it('abaixo de 3 pessoas: sem nota nem confiança ("Dados insuficientes")', () => {
    const result = computeIqp(people(2, { atendimento: 5 }), {}, now);

    expect(result).toMatchObject({
      score: null,
      confidence: null,
      reviewers: 2,
    });
  });

  it('"não disponível" não vira nota baixa', () => {
    const semBanheiro = computeIqp(
      people(3, { limpeza: 5, banheiro: null }),
      {},
      now,
    );
    const banheiroRuim = computeIqp(
      people(3, { limpeza: 5, banheiro: 1 }),
      {},
      now,
    );

    // Sem banheiro: só a limpeza conta. Banheiro ruim: (68,75 + 31,25) / 2.
    expect(semBanheiro.dimensions.limpeza_infraestrutura.score).toBe(68.75);
    expect(banheiroRuim.dimensions.limpeza_infraestrutura.score).toBe(50);
  });

  it('dimensão sem dados fica de fora e o peso se redistribui', () => {
    // (68,75 × 30 + 31,25 × 10) / (30 + 10) = 59,375
    const result = computeIqp(
      people(3, { atendimento: 5, seguranca: 1 }),
      {},
      now,
    );

    expect(result.score).toBe(59.38);
    expect(result.dimensions.transparencia).toEqual({
      score: null,
      weight: 20,
    });
  });

  it('pergunta de sim/não: sim = 100, não = 0', () => {
    // (5 × 50 + 100 + 100 + 0) / (5 + 3) = 56,25
    const result = computeIqp(
      [
        review('a', { preco_conforme: true }),
        review('b', { preco_conforme: true }),
        review('c', { preco_conforme: false }),
      ],
      {},
      now,
    );

    expect(result.dimensions.transparencia.score).toBe(56.25);
  });

  it('avaliação antiga perde metade do peso a cada 180 dias', () => {
    // Pesos 1, 1 e 0,5: (5 × 50 + 100 + 100 + 0) / (5 + 2,5) = 60
    const result = computeIqp(
      [
        review('a', { atendimento: 5 }),
        review('b', { atendimento: 5 }),
        review('c', { atendimento: 1 }, 180),
      ],
      {},
      now,
    );

    expect(result.score).toBe(60);
    expect(result.effectiveReviews).toBe(2.5);
  });

  it('só a avaliação mais recente de cada pessoa conta', () => {
    const result = computeIqp(
      [
        review('a', { atendimento: 1 }, 40),
        review('a', { atendimento: 5 }, 1),
        review('b', { atendimento: 5 }),
        review('c', { atendimento: 5 }),
      ],
      {},
      now,
    );

    expect(result.reviewers).toBe(3);
    expect(result.dimensions.atendimento_agilidade.score).toBeCloseTo(68.7, 0);
  });

  it('avaliação só com "não disponível" não conta como pessoa', () => {
    const result = computeIqp(
      [...people(2, { atendimento: 4 }), review('x', { banheiro: null })],
      {},
      now,
    );

    expect(result.reviewers).toBe(2);
    expect(result.score).toBeNull();
  });

  it('usa a média da cidade como ponto de partida', () => {
    // Cidade com média 100 em atendimento: (5 × 100 + 3 × 100) / 8 = 100
    const prior = computeCityPrior(
      [
        review('x', { atendimento: 5 }, 0, 'outro'),
        review('y', { atendimento: 5 }, 0, 'outro'),
      ],
      now,
    );
    expect(prior.atendimento).toBe(100);

    expect(computeIqp(people(3, { atendimento: 5 }), prior, now).score).toBe(
      100,
    );
  });

  it.each([
    [4, 'baixa'],
    [5, 'media'],
    [15, 'media'],
    [16, 'alta'],
  ] as const)('%i avaliações efetivas: confiança %s', (count, confidence) => {
    const result = computeIqp(people(count, { atendimento: 4 }), {}, now);
    expect(result.confidence).toBe(confidence);
  });
});

describe('computeCityPrior', () => {
  it('considera a avaliação mais recente de cada pessoa em cada posto', () => {
    const prior = computeCityPrior(
      [
        review('a', { atendimento: 1 }, 10, 'p1'),
        review('a', { atendimento: 5 }, 1, 'p1'),
        review('a', { atendimento: 3 }, 1, 'p2'),
      ],
      now,
    );

    // A mesma pessoa em postos diferentes conta duas vezes: (100 + 50) / 2,
    // com pesos quase iguais (as duas têm 1 dia).
    expect(prior.atendimento).toBe(75);
    expect(prior.banheiro).toBeUndefined();
  });
});
