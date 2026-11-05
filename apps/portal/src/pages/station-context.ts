import type { Station } from '@tankei/shared';
import { useOutletContext } from 'react-router';

/** O posto em uso, entregue pela moldura (StationShell) às telas filhas. */
export interface StationContext {
  station: Station;
}

export function useStationContext(): StationContext {
  return useOutletContext<StationContext>();
}
