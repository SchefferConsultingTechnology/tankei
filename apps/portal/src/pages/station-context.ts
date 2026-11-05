import type { MyOrganization, OrgRole, Station } from '@tankei/shared';
import { roleCan, type OrgAction } from '@tankei/shared';
import { useOutletContext } from 'react-router';

/** O que a moldura (PortalShell) entrega às telas: rede, papel e unidade. */
export interface PortalContext {
  org: MyOrganization;
  role: OrgRole;
  /** Nula nas telas da rede (visão geral, equipe). */
  station: Station | null;
}

export function usePortalContext(): PortalContext {
  return useOutletContext<PortalContext>();
}

/** Nas telas de unidade, o posto em uso. */
export function useStationContext(): PortalContext & { station: Station } {
  const context = usePortalContext();
  if (!context.station) throw new Error('Tela de unidade sem posto.');
  return context as PortalContext & { station: Station };
}

/** Atalho: o papel permite a ação? (a API confere de novo). */
export function useCan(action: OrgAction): boolean {
  return roleCan(usePortalContext().role, action);
}
