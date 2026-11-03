import type { FuelType } from '@tankei/shared';

/** Linha de planilha como o read-excel-file devolve. */
export type SheetCell = string | number | boolean | Date | null;
export type SheetRow = SheetCell[];

export interface ParsedReference {
  weekStart: string;
  weekEnd: string;
  state: string;
  fuelType: FuelType;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  stationsSurveyed: number;
}

/** Produtos do resumo. "OLEO DIESEL" é o S500 comum, segundo a própria planilha. GLP fica de fora. */
const PRODUCTS: Record<string, FuelType> = {
  'GASOLINA COMUM': 'gasolina_comum',
  'GASOLINA ADITIVADA': 'gasolina_aditivada',
  'ETANOL HIDRATADO': 'etanol',
  'OLEO DIESEL S10': 'diesel_s10',
  'OLEO DIESEL': 'diesel_s500',
  GNV: 'gnv',
};
const IGNORED_PRODUCTS = new Set(['GLP']);

const STATES: Record<string, string> = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPA: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARA: 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  GOIAS: 'GO',
  MARANHAO: 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  PARA: 'PA',
  PARAIBA: 'PB',
  PARANA: 'PR',
  PERNAMBUCO: 'PE',
  PIAUI: 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  RONDONIA: 'RO',
  RORAIMA: 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
};

const COLUMNS = {
  weekStart: 'DATA INICIAL',
  weekEnd: 'DATA FINAL',
  state: 'ESTADOS',
  product: 'PRODUTO',
  stationsSurveyed: 'NUMERO DE POSTOS PESQUISADOS',
  averagePrice: 'PRECO MEDIO REVENDA',
  minPrice: 'PRECO MINIMO REVENDA',
  maxPrice: 'PRECO MAXIMO REVENDA',
} as const;

/**
 * Converte a aba ESTADOS do resumo semanal da ANP. As colunas são localizadas
 * pelo título, e um produto ou estado desconhecido interrompe a importação:
 * mudança no formato da planilha precisa ser revisada, não ignorada.
 */
export function parseResumoEstados(rows: SheetRow[]): ParsedReference[] {
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => normalize(cell) === COLUMNS.weekStart),
  );
  if (headerIndex < 0) {
    throw new Error('Cabeçalho "DATA INICIAL" não encontrado na aba ESTADOS.');
  }

  const header = rows[headerIndex].map(normalize);
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([field, title]) => {
      const index = header.indexOf(title);
      if (index < 0) throw new Error(`Coluna "${title}" não encontrada.`);
      return [field, index];
    }),
  ) as Record<keyof typeof COLUMNS, number>;

  const references: ParsedReference[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (row.every((cell) => cell === null)) continue;

    const product = normalize(row[col.product]);
    if (IGNORED_PRODUCTS.has(product)) continue;
    const fuelType = PRODUCTS[product];
    if (!fuelType) throw new Error(`Produto desconhecido: "${product}".`);

    const stateName = normalize(row[col.state]);
    const state = STATES[stateName];
    if (!state) throw new Error(`Estado desconhecido: "${stateName}".`);

    references.push({
      weekStart: toIsoDate(row[col.weekStart]),
      weekEnd: toIsoDate(row[col.weekEnd]),
      state,
      fuelType,
      averagePrice: toNumber(row[col.averagePrice]),
      minPrice: toNumber(row[col.minPrice]),
      maxPrice: toNumber(row[col.maxPrice]),
      stationsSurveyed: toNumber(row[col.stationsSurveyed]),
    });
  }

  if (references.length === 0) {
    throw new Error('Nenhuma referência encontrada na aba ESTADOS.');
  }
  return references;
}

function normalize(cell: SheetCell): string {
  const text = cell instanceof Date ? cell.toISOString() : String(cell ?? '');
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function toIsoDate(cell: SheetCell): string {
  if (!(cell instanceof Date) || Number.isNaN(cell.getTime())) {
    throw new Error(`Data inválida no resumo: "${normalize(cell)}".`);
  }
  return cell.toISOString().slice(0, 10);
}

function toNumber(cell: SheetCell): number {
  if (typeof cell !== 'number' || !Number.isFinite(cell)) {
    throw new Error(`Número inválido no resumo: "${normalize(cell)}".`);
  }
  return cell;
}
