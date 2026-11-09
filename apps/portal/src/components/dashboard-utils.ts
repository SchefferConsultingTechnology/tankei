import type { DashboardGranularity } from '@tankei/shared';

/** Constantes dos painéis do portal (as mesmas dos dashboards do admin). */

/** Cor única dos gráficos (uma série cada), validada nos dois temas. */
export const SERIES = { light: '#2a78d6', dark: '#3987e5' } as const;

export const PERIODS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
  { value: 365, label: '12 meses' },
] as const;

/** Data local em AAAA-MM-DD. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Últimos `days` dias, até hoje. */
export function lastDays(days: number): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - days + 1);
  return { from: isoDay(from), to: isoDay(today) };
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function bucketLabel(start: string, granularity: DashboardGranularity) {
  const [y, m, d] = start.split('-').map(Number);
  if (granularity === 'mes') return `${MONTHS[m - 1]}/${String(y).slice(2)}`;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export const GRANULARITY_LABEL: Record<DashboardGranularity, string> = {
  dia: 'por dia',
  semana: 'por semana',
  mes: 'por mês',
};

export const number = (n: number) => n.toLocaleString('pt-BR');
