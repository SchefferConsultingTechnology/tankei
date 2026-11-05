import type { OrgRole } from '@tankei/shared';
import type { Database } from '../../src/database/database.module';
import {
  organizationMembers,
  organizations,
  organizationStations,
} from '../../src/database/schema';

/**
 * Cria uma rede com os postos e dá à pessoa o papel nela (ADR 0021): é assim
 * que alguém passa a ter acesso ao posto pelo portal.
 */
export async function addToNetwork(
  db: Database,
  userId: string,
  stationIds: string[],
  role: OrgRole = 'proprietario',
): Promise<string> {
  const [organization] = await db
    .insert(organizations)
    .values({ name: `Rede de teste ${stationIds[0]}` })
    .returning({ id: organizations.id });
  await db.insert(organizationStations).values(
    stationIds.map((stationId) => ({
      organizationId: organization.id,
      stationId,
    })),
  );
  await db
    .insert(organizationMembers)
    .values({ organizationId: organization.id, userId, role, scope: 'todas' });
  return organization.id;
}
