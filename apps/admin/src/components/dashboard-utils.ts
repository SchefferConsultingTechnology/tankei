import type { DashboardGranularity } from '@tankei/shared';
import { useState } from 'react';

/** Constantes e estado comuns aos dashboards do admin (ADR 0037 e 0038). */

/** Cor única dos gráficos (uma série cada), validada nos dois temas. */
export const SERIES = { light: '#2a78d6', dark: '#3987e5' } as const;

export const PRESETS = [
  { value: '30d', label: '30 dias', days: 30 },
  { value: '90d', label: '90 dias', days: 90 },
  { value: '12m', label: '12 meses', days: 365 },
  { value: 'ano', label: 'Este ano', days: null },
] as const;
export type Preset = (typeof PRESETS)[number]['value'] | 'livre';

/** Data local (Brasília no uso real) em AAAA-MM-DD. */
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presetRange(preset: Preset): { from: string; to: string } | null {
  const today = new Date();
  const found = PRESETS.find((p) => p.value === preset);
  if (!found) return null;
  if (found.days === null) {
    return { from: `${today.getFullYear()}-01-01`, to: isoDay(today) };
  }
  const from = new Date(today);
  from.setDate(from.getDate() - found.days + 1);
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


/** Estado dos filtros (período e UF), compartilhado pelos dashboards. */
export function useDashboardFilters() {
  const [preset, setPreset] = useState<Preset>('12m');
  const [range, setRange] = useState(() => presetRange('12m')!);
  const [state, setState] = useState('');
  return {
    preset,
    range,
    state,
    query: { from: range.from, to: range.to, state: state || undefined },
    choosePreset(value: Preset) {
      setPreset(value);
      const next = presetRange(value);
      if (next) setRange(next);
    },
    setFrom(from: string) {
      setPreset('livre');
      setRange((r) => ({ ...r, from }));
    },
    setTo(to: string) {
      setPreset('livre');
      setRange((r) => ({ ...r, to }));
    },
    setState,
  };
}

