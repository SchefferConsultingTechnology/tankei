import {
  classifyReport,
  computeCurrentPrice,
  distanceMeters,
  reportWeight,
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
    divergenceResponseHours: 24,
  };
  const now = new Date('2026-11-03T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  function driver(
    price: number,
    hours: number,
    user: string,
    status: ReportForDisplay['status'] = 'valido',
    weight = 1,
  ): ReportForDisplay {
    return {
      price,
      source: 'usuario',
      status,
      reporterUserId: user,
      reportedAt: hoursAgo(hours),
      weight,
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
      weight: 1,
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

  it('consumidores confirmados depois do posto abrem divergência no prazo', () => {
    expect(
      compute([
        driver(6.49, 1, 'ana'),
        driver(6.49, 2, 'bia'),
        station(6.29, 5),
      ]),
    ).toMatchObject({
      price: 6.29,
      badge: 'atualizado_posto',
      divergence: { price: 6.49, respondBy: hoursAgo(1 - 24) },
    });
  });

  it('sem resposta do posto no prazo, vale o valor dos consumidores', () => {
    expect(
      compute([
        driver(6.49, 30, 'ana'),
        driver(6.49, 31, 'bia'),
        station(6.29, 40),
      ]),
    ).toMatchObject({
      price: 6.49,
      badge: 'confirmado_motoristas',
      divergence: null,
    });
  });

  it('preço oficial (ADR 0028): consumidores nunca substituem, o aviso fica', () => {
    expect(
      computeCurrentPrice(
        [driver(6.49, 30, 'ana'), driver(6.49, 31, 'bia'), station(6.29, 40)],
        now,
        params,
        { officialPrice: true },
      ),
    ).toMatchObject({
      price: 6.29,
      badge: 'atualizado_posto',
      divergence: { price: 6.49 },
    });
  });

  it('o posto reconfirma: a divergência se encerra', () => {
    expect(
      compute([
        station(6.29, 0.5),
        driver(6.49, 1, 'ana'),
        driver(6.49, 2, 'bia'),
        station(6.29, 5),
      ]),
    ).toMatchObject({
      price: 6.29,
      badge: 'atualizado_posto',
      divergence: null,
    });
  });

  it('consumidores confirmam o mesmo valor do posto: "Confirmado"', () => {
    expect(
      compute([
        driver(6.29, 1, 'ana'),
        driver(6.29, 2, 'bia'),
        station(6.29, 5),
      ]),
    ).toMatchObject({ price: 6.29, badge: 'confirmado_motoristas' });
  });

  it('informe isolado diferente do posto: indica outro valor', () => {
    expect(compute([driver(6.49, 1, 'ana'), station(6.29, 5)])).toMatchObject({
      price: 6.29,
      divergence: null,
      otherValueReported: true,
    });
  });

  it('confirmação anterior ao preço do posto não o substitui', () => {
    expect(
      compute([
        station(6.29, 1),
        driver(6.49, 3, 'ana'),
        driver(6.49, 4, 'bia'),
      ]),
    ).toMatchObject({
      price: 6.29,
      badge: 'atualizado_posto',
      divergence: null,
    });
  });

  describe('desempate e peso (ADR 0024)', () => {
    it('vence o valor com mais pessoas, mesmo que outro seja mais recente', () => {
      expect(
        compute([
          driver(6.59, 1, 'caio'),
          driver(6.49, 5, 'ana'),
          driver(6.49, 6, 'bia'),
        ]),
      ).toMatchObject({
        price: 6.49,
        badge: 'confirmado_motoristas',
        otherValueReported: true,
      });
    });

    it('empate: vale o mais recente', () => {
      expect(
        compute([driver(6.59, 1, 'caio'), driver(6.49, 5, 'ana')]),
      ).toMatchObject({
        price: 6.59,
        badge: 'informado_motorista',
        otherValueReported: true,
      });
    });

    it('fora da janela, o informe novo vale sozinho', () => {
      expect(
        compute([
          driver(6.59, 1, 'caio'),
          driver(6.49, 60, 'ana'),
          driver(6.49, 61, 'bia'),
        ]),
      ).toMatchObject({ price: 6.59, otherValueReported: false });
    });

    it('conta nova (peso 0) informa, mas não confirma', () => {
      expect(
        compute([driver(6.49, 1, 'nova', 'valido', 0), driver(6.49, 2, 'ana')]),
      ).toMatchObject({ price: 6.49, badge: 'informado_motorista' });
    });

    it('à distância vale metade: duas pessoas longe não confirmam', () => {
      expect(
        compute([
          driver(6.49, 1, 'ana', 'valido', 0.5),
          driver(6.49, 2, 'bia', 'valido', 0.5),
        ]),
      ).toMatchObject({ badge: 'informado_motorista' });
      expect(
        compute([
          driver(6.49, 1, 'ana', 'valido', 0.5),
          driver(6.49, 2, 'bia', 'valido', 0.5),
          driver(6.49, 3, 'caio'),
        ]),
      ).toMatchObject({ badge: 'confirmado_motoristas' });
    });

    it('mais pessoas de contas novas não vencem menos pessoas confiáveis', () => {
      expect(
        compute([
          driver(7.99, 1, 'n1', 'valido', 0),
          driver(7.99, 2, 'n2', 'valido', 0),
          driver(7.99, 3, 'n3', 'valido', 0),
          driver(6.49, 4, 'ana'),
        ]),
      ).toMatchObject({ price: 6.49 });
    });
  });

  describe('peso de cada informe', () => {
    it('conta não confiável: 0; no posto: 1; longe ou sem localização: o parâmetro', () => {
      expect(reportWeight(false, true, 50)).toBe(0);
      expect(reportWeight(true, true, 50)).toBe(1);
      expect(reportWeight(true, false, 50)).toBe(0.5);
      expect(reportWeight(true, null, 50)).toBe(0.5);
    });

    it('distância entre pontos (haversine)', () => {
      const centro = { latitude: -27.2838, longitude: -50.5826 };
      const perto = { latitude: -27.2848, longitude: -50.5826 };
      expect(Math.round(distanceMeters(centro, perto))).toBe(111);
    });
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
