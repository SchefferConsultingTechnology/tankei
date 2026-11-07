import {
  dayScheduleSchema,
  isNationalHoliday,
  openingStatus,
  type OpeningHours,
} from '@tankei/shared';

/** Hora local de Brasília (-3) como Date em UTC. */
const brt = (iso: string) => new Date(`${iso}-03:00`);

const comercial: OpeningHours = {
  dias_uteis: {
    mode: 'horario',
    intervals: [{ open: '06:00', close: '22:00' }],
  },
  sabado: { mode: 'horario', intervals: [{ open: '07:00', close: '13:00' }] },
  domingo: { mode: 'fechado', intervals: [] },
  feriado: { mode: 'fechado', intervals: [] },
};

describe('Feriados nacionais (ADR 0033)', () => {
  it('fixos e Sexta-feira Santa; Carnaval não', () => {
    expect(isNationalHoliday(2026, 11, 20)).toBe(true); // Consciência Negra
    expect(isNationalHoliday(2026, 11, 15)).toBe(true);
    expect(isNationalHoliday(2026, 4, 3)).toBe(true); // Sexta-feira Santa 2026
    expect(isNationalHoliday(2027, 3, 26)).toBe(true); // Sexta-feira Santa 2027
    expect(isNationalHoliday(2026, 2, 17)).toBe(false); // Carnaval
    expect(isNationalHoliday(2026, 11, 9)).toBe(false);
  });
});

describe('Aberto agora (ADR 0033)', () => {
  it('sem horário informado não diz nada', () => {
    expect(openingStatus(null, 'SC', brt('2026-11-09T10:00:00'))).toBeNull();
  });

  it('dia útil: aberto, fecha às 22:00; antes de abrir, abre às 06:00', () => {
    // 09/11/2026 é segunda-feira.
    expect(openingStatus(comercial, 'SC', brt('2026-11-09T10:00:00'))).toEqual({
      open: true,
      label: 'Aberto · fecha às 22:00',
    });
    expect(openingStatus(comercial, 'SC', brt('2026-11-09T05:30:00'))).toEqual({
      open: false,
      label: 'Fechado · abre às 06:00',
    });
    expect(openingStatus(comercial, 'SC', brt('2026-11-09T23:00:00'))).toEqual({
      open: false,
      label: 'Fechado · abre amanhã às 06:00',
    });
  });

  it('sábado à tarde: fechado até segunda; feriado usa o horário de feriado', () => {
    // 14/11/2026 é sábado; 15/11 (domingo) e 16/11 normal.
    expect(openingStatus(comercial, 'SC', brt('2026-11-14T15:00:00'))).toEqual({
      open: false,
      label: 'Fechado · abre segunda às 06:00',
    });
    // 20/11/2026 (sexta) é feriado: fechado.
    expect(
      openingStatus(comercial, 'SC', brt('2026-11-20T10:00:00'))?.open,
    ).toBe(false);
  });

  it('horário que passa da meia-noite e 24 horas', () => {
    const noite: OpeningHours = {
      ...comercial,
      dias_uteis: {
        mode: 'horario',
        intervals: [{ open: '18:00', close: '02:00' }],
      },
    };
    // Terça 01:00: ainda no turno de segunda.
    expect(openingStatus(noite, 'SC', brt('2026-11-10T01:00:00'))).toEqual({
      open: true,
      label: 'Aberto · fecha às 02:00',
    });
    const sempre: OpeningHours = {
      dias_uteis: { mode: '24h', intervals: [] },
      sabado: { mode: '24h', intervals: [] },
      domingo: { mode: '24h', intervals: [] },
      feriado: { mode: '24h', intervals: [] },
    };
    expect(openingStatus(sempre, 'SC', brt('2026-11-09T03:00:00'))).toEqual({
      open: true,
      label: 'Aberto 24 horas',
    });
    // Sexta 24 horas e sábado com horário: à noite, fecha à meia-noite.
    const sextaLonga: OpeningHours = {
      ...comercial,
      dias_uteis: { mode: '24h', intervals: [] },
    };
    expect(openingStatus(sextaLonga, 'SC', brt('2026-11-13T21:00:00'))).toEqual(
      {
        open: true,
        label: 'Aberto · fecha às 00:00',
      },
    );
  });

  it('usa o fuso da UF do posto (MS: -4)', () => {
    // 05:30 em Brasília = 04:30 em Campo Grande: ainda fechado até 06:00.
    expect(openingStatus(comercial, 'MS', brt('2026-11-09T06:30:00'))).toEqual({
      open: false,
      label: 'Fechado · abre às 06:00',
    });
  });
});

describe('Validação do horário (ADR 0033)', () => {
  it('recusa intervalos sobrepostos e aceita a pausa do almoço', () => {
    const day = (a: [string, string], b: [string, string]) =>
      dayScheduleSchema.safeParse({
        mode: 'horario',
        intervals: [
          { open: a[0], close: a[1] },
          { open: b[0], close: b[1] },
        ],
      }).success;
    expect(day(['07:00', '20:00'], ['14:00', '18:00'])).toBe(false);
    expect(day(['07:00', '12:00'], ['13:30', '20:00'])).toBe(true);
    expect(day(['18:00', '02:00'], ['01:00', '05:00'])).toBe(false);
    expect(day(['06:00', '12:00'], ['18:00', '02:00'])).toBe(true);
  });
});
