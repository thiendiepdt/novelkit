import { createContext, useContext } from 'react';
import type { DripEngine, DripSnapshot } from './dripEngine';

export interface DripContextValue {
  /** Null on the web (no provider). */
  engine: DripEngine | null;
  snapshot: DripSnapshot | null;
}

export const DripContext = createContext<DripContextValue>({ engine: null, snapshot: null });

export const useDrip = () => useContext(DripContext);
