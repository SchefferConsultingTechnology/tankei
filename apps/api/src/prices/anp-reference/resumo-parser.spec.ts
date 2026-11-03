import { parseResumoEstados, type SheetRow as Row } from './resumo-parser';

const HEADER: Row = [
  'DATA INICIAL',
  'DATA FINAL',
  'REGIAO',
  'ESTADOS',
  'PRODUTO',
  'NÚMERO DE POSTOS PESQUISADOS',
  'UNIDADE DE MEDIDA',
  'PREÇO MÉDIO REVENDA',
  'DESVIO PADRÃO REVENDA',
  'PREÇO MÍNIMO REVENDA',
  'PREÇO MÁXIMO REVENDA',
  'COEF DE VARIAÇÃO REVENDA',
];

const start = new Date('2026-10-18T00:00:00.000Z');
const end = new Date('2026-10-24T00:00:00.000Z');

function row(state: string, product: string, avg: number, stations = 100): Row {
  return [
    start,
    end,
    'SUL',
    state,
    product,
    stations,
    'R$/l',
    avg,
    0.3,
    avg - 0.5,
    avg + 0.5,
    0.04,
  ];
}

// Cabeçalho da planilha real: título, observações e uma linha vazia antes das colunas.
const PREAMBLE: Row[] = [
  ['AGÊNCIA NACIONAL DO PETRÓLEO, GÁS NATURAL E BIOCOMBUSTÍVEIS - ANP', null],
  ['TIPO RELATÓRIO: ESTADOS', null],
  [null, null],
];

describe('parseResumoEstados', () => {
  it('converte as linhas de estados e combustíveis', () => {
    const result = parseResumoEstados([
      ...PREAMBLE,
      HEADER,
      row('SANTA CATARINA', 'GASOLINA COMUM', 6.29, 159),
      row('SANTA CATARINA', 'OLEO DIESEL', 6.92),
      row('SANTA CATARINA', 'OLEO DIESEL S10', 7.23),
      row('SAO PAULO', 'ETANOL HIDRATADO', 4.1),
    ]);

    expect(result).toEqual([
      {
        weekStart: '2026-10-18',
        weekEnd: '2026-10-24',
        state: 'SC',
        fuelType: 'gasolina_comum',
        averagePrice: 6.29,
        minPrice: 5.79,
        maxPrice: 6.79,
        stationsSurveyed: 159,
      },
      expect.objectContaining({ state: 'SC', fuelType: 'diesel_s500' }),
      expect.objectContaining({ state: 'SC', fuelType: 'diesel_s10' }),
      expect.objectContaining({ state: 'SP', fuelType: 'etanol' }),
    ]);
  });

  it('ignora GLP e linhas vazias', () => {
    const result = parseResumoEstados([
      HEADER,
      row('SANTA CATARINA', 'GLP', 122.23),
      [null, null, null],
      row('SANTA CATARINA', 'GNV', 4.7),
    ]);

    expect(result.map((r) => r.fuelType)).toEqual(['gnv']);
  });

  it('localiza as colunas pelo título, mesmo em outra ordem', () => {
    const reordered = [...HEADER].reverse();
    const values = [
      ...row('SANTA CATARINA', 'GASOLINA ADITIVADA', 6.42),
    ].reverse();

    expect(parseResumoEstados([reordered, values])[0]).toMatchObject({
      state: 'SC',
      fuelType: 'gasolina_aditivada',
      averagePrice: 6.42,
    });
  });

  it.each([
    ['sem cabeçalho', [row('SANTA CATARINA', 'GNV', 4.7)], 'Cabeçalho'],
    ['coluna ausente', [HEADER.slice(0, 7)], 'Coluna'],
    [
      'produto novo',
      [HEADER, row('SANTA CATARINA', 'HIDROGENIO', 9)],
      'Produto desconhecido',
    ],
    [
      'estado desconhecido',
      [HEADER, row('ATLANTIDA', 'GNV', 4.7)],
      'Estado desconhecido',
    ],
    ['sem dados', [HEADER], 'Nenhuma referência'],
  ])('falha com %s', (_, rows, message) => {
    expect(() => parseResumoEstados(rows)).toThrow(message);
  });
});
