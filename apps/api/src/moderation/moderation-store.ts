import type {
  FuelType,
  ModerationKind,
  ModerationStatus,
} from '@tankei/shared';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { Database } from '../database/database.module';
import {
  priceModerationCaseReports,
  priceModerationCases,
  priceModerationDecisions,
} from '../database/schema';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Db = Database | Tx;

/**
 * Informes que não contam no preço exibido (ADR 0020): os de casos ainda em
 * análise e os anulados pela equipe Tankei.
 */
export async function excludedReportIds(
  db: Db,
  stationIds: string[],
): Promise<Set<string>> {
  if (stationIds.length === 0) return new Set();
  const rows = await db
    .select({ reportId: priceModerationCaseReports.reportId })
    .from(priceModerationCaseReports)
    .innerJoin(
      priceModerationCases,
      eq(priceModerationCases.id, priceModerationCaseReports.caseId),
    )
    .leftJoin(
      priceModerationDecisions,
      eq(priceModerationDecisions.caseId, priceModerationCases.id),
    )
    .where(
      and(
        inArray(priceModerationCases.stationId, stationIds),
        or(
          isNull(priceModerationDecisions.id),
          eq(priceModerationDecisions.decision, 'anulado'),
        ),
      ),
    );
  return new Set(rows.map((r) => r.reportId));
}

export interface ReportCase {
  caseId: string;
  kind: ModerationKind;
  status: ModerationStatus;
}

/** Caso de cada informe (o mais recente, se houver mais de um). */
export async function casesOfReports(
  db: Db,
  reportIds: string[],
): Promise<Map<string, ReportCase>> {
  const result = new Map<string, ReportCase>();
  if (reportIds.length === 0) return result;
  const rows = await db
    .select({
      reportId: priceModerationCaseReports.reportId,
      caseId: priceModerationCases.id,
      kind: priceModerationCases.kind,
      createdAt: priceModerationCases.createdAt,
      decision: priceModerationDecisions.decision,
    })
    .from(priceModerationCaseReports)
    .innerJoin(
      priceModerationCases,
      eq(priceModerationCases.id, priceModerationCaseReports.caseId),
    )
    .leftJoin(
      priceModerationDecisions,
      eq(priceModerationDecisions.caseId, priceModerationCases.id),
    )
    .where(inArray(priceModerationCaseReports.reportId, reportIds))
    .orderBy(priceModerationCases.createdAt);
  for (const row of rows) {
    result.set(row.reportId, {
      caseId: row.caseId,
      kind: row.kind,
      status: row.decision ?? 'em_analise',
    });
  }
  return result;
}

/** Abre um caso com os informes. */
export async function openCase(
  db: Db,
  values: {
    kind: ModerationKind;
    stationId: string;
    fuelType: FuelType;
    openedByUserId: string | null;
    reason: string | null;
    reportIds: string[];
  },
): Promise<string> {
  const [created] = await db
    .insert(priceModerationCases)
    .values({
      kind: values.kind,
      stationId: values.stationId,
      fuelType: values.fuelType,
      openedByUserId: values.openedByUserId,
      reason: values.reason,
    })
    .returning({ id: priceModerationCases.id });
  await db
    .insert(priceModerationCaseReports)
    .values(
      values.reportIds.map((reportId) => ({ caseId: created.id, reportId })),
    );
  return created.id;
}
