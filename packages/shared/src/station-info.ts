import { z } from 'zod';
import { nullable } from './validation';

/**
 * Horário de atendimento e serviços do posto (ADR 0033). O posto informa pelo
 * portal; a equipe Tankei, pelo admin. "Aberto agora" é calculado no cliente,
 * na hora local do posto.
 */

/** Tipos de dia com horário próprio. */
export const DAY_TYPES = ['dias_uteis', 'sabado', 'domingo', 'feriado'] as const;
export type DayType = (typeof DAY_TYPES)[number];

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  dias_uteis: 'Segunda a sexta',
  sabado: 'Sábado',
  domingo: 'Domingo',
  feriado: 'Feriados',
};

export const DAY_MODES = ['horario', '24h', 'fechado'] as const;
export type DayMode = (typeof DAY_MODES)[number];

export const DAY_MODE_LABELS: Record<DayMode, string> = {
  horario: 'Horário',
  '24h': '24 horas',
  fechado: 'Fechado',
};

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM).');

/**
 * Intervalo de atendimento. Fechamento igual ou antes da abertura passa da
 * meia-noite (ex.: 18:00 às 02:00).
 */
export const openingIntervalSchema = z
  .object({ open: time, close: time })
  .refine((i) => i.open !== i.close, {
    message: 'Abertura e fechamento iguais: use "24 horas".',
  });
export type OpeningInterval = z.infer<typeof openingIntervalSchema>;

/** Os intervalos se sobrepõem (no ciclo de 24 h)? */
function overlaps(intervals: OpeningInterval[]): boolean {
  if (intervals.length < 2) return false;
  const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const spans = intervals.map((i) => {
    const open = minutes(i.open);
    const close = minutes(i.close);
    return [open, close > open ? close : close + 1440] as const;
  });
  const [a, b] = spans;
  // Compara também com o segundo deslocado um dia (turnos da madrugada).
  return [0, 1440, -1440].some(
    (shift) => a[0] < b[1] + shift && b[0] + shift < a[1],
  );
}

/**
 * Formato gravado, sem as regras de preenchimento: a leitura aceita o que já
 * foi salvo, mesmo que as regras de entrada fiquem mais rígidas depois.
 */
const storedDaySchema = z.object({
  mode: z.enum(DAY_MODES),
  intervals: z
    .array(z.object({ open: time, close: time }))
    .default([])
    .describe('Só no modo "horario": um ou dois intervalos.'),
});

/** Regras de preenchimento (portal e admin). */
export const dayScheduleSchema = z
  .object({
    mode: z.enum(DAY_MODES),
    intervals: z
      .array(openingIntervalSchema)
      .max(2, 'No máximo dois intervalos por dia.')
      .default([]),
  })
  .refine((d) => d.mode !== 'horario' || d.intervals.length > 0, {
    message: 'Informe ao menos um intervalo.',
  })
  .refine((d) => d.mode !== 'horario' || !overlaps(d.intervals), {
    message: 'Os dois intervalos não podem se sobrepor.',
  });
export type DaySchedule = z.infer<typeof dayScheduleSchema>;

export const openingHoursSchema = z.object({
  dias_uteis: dayScheduleSchema,
  sabado: dayScheduleSchema,
  domingo: dayScheduleSchema,
  feriado: dayScheduleSchema,
});
export type OpeningHours = z.infer<typeof openingHoursSchema>;

/** Horário como é lido (respostas da API): sem as regras de preenchimento. */
export const storedOpeningHoursSchema = z.object({
  dias_uteis: storedDaySchema,
  sabado: storedDaySchema,
  domingo: storedDaySchema,
  feriado: storedDaySchema,
});

/** Serviços marcados no posto. A lista pode crescer. */
export const STATION_SERVICES = ['calibrador', 'borracharia'] as const;
export type StationService = (typeof STATION_SERVICES)[number];

export const STATION_SERVICE_LABELS: Record<StationService, string> = {
  calibrador: 'Calibragem',
  borracharia: 'Borracharia',
};

/** Horário e serviços, como o portal e o admin editam. */
export const stationInfoSchema = z.object({
  hours: nullable(
    storedOpeningHoursSchema,
    'Horário de atendimento, se informado.',
  ),
  services: z.array(z.enum(STATION_SERVICES)),
  updatedAt: nullable(z.iso.datetime(), 'Última alteração.'),
  updatedBy: nullable(
    z.enum(['posto', 'equipe']),
    'Quem fez a última alteração: o posto (portal) ou a equipe Tankei (admin).',
  ),
});
export type StationInfo = z.infer<typeof stationInfoSchema>;

export const updateStationInfoSchema = z.object({
  hours: openingHoursSchema.nullable(),
  services: z
    .array(z.enum(STATION_SERVICES, { error: 'Serviço inválido.' }))
    .refine((list) => new Set(list).size === list.length, 'Serviço repetido.'),
});
export type UpdateStationInfo = z.output<typeof updateStationInfoSchema>;

// ---------- Feriados nacionais ----------

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC. */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Feriados nacionais fixos (Leis 662/1949, 6.802/1980, 10.607/2002 e 14.759/2023). */
const FIXED_HOLIDAYS = [
  '01-01',
  '04-21',
  '05-01',
  '09-07',
  '10-12',
  '11-02',
  '11-15',
  '11-20',
  '12-25',
];

/**
 * É feriado nacional? Fixos mais a Sexta-feira Santa. Carnaval e Corpus
 * Christi são ponto facultativo e ficam de fora; feriados estaduais e
 * municipais, por enquanto, também (ADR 0033).
 */
export function isNationalHoliday(year: number, month: number, day: number) {
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (FIXED_HOLIDAYS.includes(key)) return true;
  const goodFriday = new Date(easter(year).getTime() - 2 * 86_400_000);
  return (
    goodFriday.getUTCMonth() + 1 === month && goodFriday.getUTCDate() === day
  );
}

// ---------- Aberto agora ----------

/**
 * Diferença para UTC (horas) por UF. O Brasil não tem horário de verão desde
 * 2019. Fernando de Noronha (-2) fica com Pernambuco.
 */
const UTC_OFFSET_BY_STATE: Record<string, number> = {
  AC: -5,
  AM: -4,
  RO: -4,
  RR: -4,
  MT: -4,
  MS: -4,
};
const DEFAULT_UTC_OFFSET = -3;

interface LocalDay {
  year: number;
  month: number;
  day: number;
  /** 0 = domingo. */
  weekday: number;
}

function localDay(utcMs: number): LocalDay {
  const d = new Date(utcMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

export function dayTypeOf(day: LocalDay): DayType {
  if (isNationalHoliday(day.year, day.month, day.day)) return 'feriado';
  if (day.weekday === 0) return 'domingo';
  if (day.weekday === 6) return 'sabado';
  return 'dias_uteis';
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Faixas [início, fim) em minutos desde a meia-noite do dia, de 0 a 2880. */
function ranges(schedule: DaySchedule): [number, number][] {
  if (schedule.mode === 'fechado') return [];
  if (schedule.mode === '24h') return [[0, 1440]];
  return schedule.intervals.map((i) => {
    const open = toMinutes(i.open);
    const close = toMinutes(i.close);
    return [open, close > open ? close : close + 1440];
  });
}

const WEEKDAY_NAMES = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

export interface OpeningStatus {
  open: boolean;
  /** Ex.: "Aberto 24 horas", "Aberto · fecha às 22:00", "Fechado · abre às 06:00". */
  label: string;
}

/**
 * Situação do posto agora, na hora local da UF dele. Nulo sem horário
 * informado (o app não mostra nada, em vez de "fechado").
 */
export function openingStatus(
  hours: OpeningHours | null,
  state: string,
  now: Date = new Date(),
): OpeningStatus | null {
  if (!hours) return null;
  const offset = (UTC_OFFSET_BY_STATE[state] ?? DEFAULT_UTC_OFFSET) * 3_600_000;
  const localNow = now.getTime() + offset;
  const minute = Math.floor((localNow % 86_400_000) / 60_000);
  const startOfToday = localNow - minute * 60_000 - (localNow % 60_000);

  // Faixas de ontem (as que passam da meia-noite) até daqui a 7 dias, na
  // escala de minutos a partir da meia-noite de hoje.
  const all: [number, number][] = [];
  for (let d = -1; d <= 7; d++) {
    const day = localDay(startOfToday + d * 86_400_000);
    for (const [start, end] of ranges(hours[dayTypeOf(day)])) {
      all.push([start + d * 1440, end + d * 1440]);
    }
  }
  all.sort((a, b) => a[0] - b[0]);
  // Junta faixas que se encostam (ex.: 24 horas em dias seguidos).
  const merged: [number, number][] = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }

  const current = merged.find(([s, e]) => s <= minute && minute < e);
  if (current) {
    // Só diz "24 horas" se não fecha nas próximas 24 h.
    if (current[1] - minute >= 1440) {
      return { open: true, label: 'Aberto 24 horas' };
    }
    return { open: true, label: `Aberto · fecha às ${toTime(current[1])}` };
  }
  const next = merged.find(([s]) => s > minute);
  if (!next) return { open: false, label: 'Fechado' };
  const dayOffset = Math.floor(next[0] / 1440);
  const at = toTime(next[0]);
  if (dayOffset === 0) return { open: false, label: `Fechado · abre às ${at}` };
  if (dayOffset === 1) {
    return { open: false, label: `Fechado · abre amanhã às ${at}` };
  }
  const weekday = localDay(startOfToday + dayOffset * 86_400_000).weekday;
  return {
    open: false,
    label: `Fechado · abre ${WEEKDAY_NAMES[weekday]} às ${at}`,
  };
}

/** Texto de um tipo de dia: "06:00 às 22:00", "24 horas", "Fechado". */
export function describeDay(schedule: DaySchedule): string {
  if (schedule.mode === 'fechado') return 'Fechado';
  if (schedule.mode === '24h') return '24 horas';
  return schedule.intervals.map((i) => `${i.open} às ${i.close}`).join(' e ');
}
