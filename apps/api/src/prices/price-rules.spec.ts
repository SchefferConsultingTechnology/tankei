import {
  classifyReport,
  computeCurrentPrice,
  type DisplayParams,
  type ReportForDisplay,
} from './price-rules';

describe('classifyReport', () => {
  const params = { normalPct: 25, maxPct: 60 };
  const reference = 6.29;

  it.each([
    ['dentro do limite normal', 6.49, false, 'valido'],
    ['no limite normal exato', 6.29 * 1.25, false, 'valido'],
    ['acima do limite normal', 8.2, false, 'suspeito'],
    ['Dia Livre de Impostos (-45%)', 3.459, false, 'suspeito'],
    ['acima do limite máximo', 10.5, false, 'rejeitado'],
    ['erro de digitação (vírgula)', 0.629, false, 'rejeitado'],
    ['promoção abaixo do limite normal', 3.459, true, 'valido'],
    ['promoção acima do limite máximo', 0.629, true, 'rejeitado'],
  ] as const)('%s → %s', (_, price, isPromotion, status) => {
    expect(classifyReport(price, reference, isPromotion, params).status).toBe(
      status,
    );
  });

  it('guarda a distância da referência', () => {
    expect(classifyReport(3.459, reference, false, params).deviationPct).toBe(
      45.01,
    );
  });

  it('aceita sem referência disponível', () => {
    expect(classifyReport(0.629, null, false, params)).toEqual({
      status: 'valido',
      deviationPct: null,
    });
  });
});

describe('computeCurrentPrice', () => {
  const params: DisplayParams = {
    confirmationWindowHours: 48,
    confirmationsRequired: 2,
    staleAfterDays: 7,
    hideAfterDays: 30,
  };
  const now = new Date('2026-11-03T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  function driver(
    price: number,
    hours: number,
    user: string,
    status: ReportForDisplay['status'] = 'valido',
  ): ReportForDisplay {
    return {
      price,
      source: 'usuario',
      status,
      reporterUserId: user,
      reportedAt: hoursAgo(hours),
      promotion: null,
    };
  }

  function station(
    price: number,
    hours: number,
    status: ReportForDisplay['status'] = 'valido',
  ): ReportForDisplay {
    return {
      price,
      source: 'posto',
      status,
      reporterUserId: 'gestor',
      reportedAt: hoursAgo(hours),
      promotion: null,
    };
  }

  const compute = (reports: ReportForDisplay[]) =>
    computeCurrentPrice(reports, now, params);

  it('sem informes, não há preço', () => {
    expect(compute([])).toBeNull();
  });

  it('um motorista: "Informado por motorista"', () => {
    expect(compute([driver(6.29, 1, 'ana')])).toMatchObject({
      price: 6.29,
      badge: 'informado_motorista',
      stale: false,
    });
  });

  it('duas pessoas com o mesmo valor na janela: "Confirmado por motoristas"', () => {
    expect(
      compute([driver(6.29, 1, 'ana'), driver(6.29, 20, 'bia')]),
    ).toMatchObject({ price: 6.29, badge: 'confirmado_motoristas' });
  });

  it('a mesma pessoa duas vezes não confirma', () => {
    expect(
      compute([driver(6.29, 1, 'ana'), driver(6.29, 20, 'ana')]),
    ).toMatchObject({ badge: 'informado_motorista' });
  });

  it('valores iguais fora da janela não confirmam', () => {
    expect(
      compute([driver(6.29, 1, 'ana'), driver(6.29, 60, 'bia')]),
    ).toMatchObject({ badge: 'informado_motorista' });
  });

  it('informe suspeito de motorista só aparece quando confirmado', () => {
    expect(compute([driver(3.459, 1, 'ana', 'suspeito')])).toBeNull();
    expect(
      compute([
        driver(3.459, 1, 'ana', 'suspeito'),
        driver(3.459, 2, 'bia', 'suspeito'),
      ]),
    ).toMatchObject({ price: 3.459, badge: 'confirmado_motoristas' });
  });

  it('informe rejeitado nunca aparece', () => {
    expect(compute([driver(0.629, 1, 'ana', 'rejeitado')])).toBeNull();
  });

  it('preço do posto: "Atualizado pelo posto", mesmo suspeito', () => {
    expect(compute([station(3.459, 1, 'suspeito')])).toMatchObject({
      price: 3.459,
      badge: 'atualizado_posto',
    });
  });

  it('motorista sozinho não substitui o preço do posto', () => {
    expect(compute([driver(6.49, 1, 'ana'), station(6.29, 5)])).toMatchObject({
      price: 6.29,
      badge: 'atualizado_posto',
    });
  });

  it('motoristas confirmados depois do posto substituem o preço do posto', () => {
    expect(
      compute([
        driver(6.49, 1, 'ana'),
        driver(6.49, 2, 'bia'),
        station(6.29, 5),
      ]),
    ).toMatchObject({ price: 6.49, badge: 'confirmado_motoristas' });
  });

  it('confirmação anterior ao preço do posto não o substitui', () => {
    expect(
      compute([
        station(6.29, 1),
        driver(6.49, 3, 'ana'),
        driver(6.49, 4, 'bia'),
      ]),
    ).toMatchObject({ price: 6.29, badge: 'atualizado_posto' });
  });

  it('sem posto, vale o mais recente entre confirmado e informe isolado', () => {
    expect(
      compute([
        driver(6.59, 1, 'caio'),
        driver(6.49, 5, 'ana'),
        driver(6.49, 6, 'bia'),
      ]),
    ).toMatchObject({ price: 6.59, badge: 'informado_motorista' });
  });

  it('marca como desatualizado depois do prazo', () => {
    expect(compute([station(6.29, 8 * 24)])).toMatchObject({
      badge: 'atualizado_posto',
      stale: true,
    });
  });

  it('deixa de exibir depois do prazo máximo', () => {
    expect(compute([station(6.29, 31 * 24)])).toBeNull();
  });

  describe('promoção', () => {
    const promo = (startH: number, endH: number): ReportForDisplay => ({
      ...station(3.459, 30),
      promotion: {
        label: 'Dia Livre de Impostos',
        startsAt: hoursAgo(startH),
        endsAt: hoursAgo(endH),
      },
    });

    it('vigente: vale sobre o preço do posto e dos motoristas', () => {
      expect(
        compute([station(6.29, 1), driver(6.49, 1, 'ana'), promo(2, -6)]),
      ).toMatchObject({
        price: 3.459,
        badge: 'promocao',
        promotion: { label: 'Dia Livre de Impostos' },
      });
    });

    it('encerrada: volta o preço normal', () => {
      expect(compute([station(6.29, 48), promo(10, 1)])).toMatchObject({
        price: 6.29,
        badge: 'atualizado_posto',
      });
    });

    it('agendada: ainda não vale', () => {
      expect(compute([station(6.29, 48), promo(-24, -30)])).toMatchObject({
        price: 6.29,
      });
    });
  });
});
