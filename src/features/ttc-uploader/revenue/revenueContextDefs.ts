import { createContext, useContext } from 'react';
import type { RevenueEngine, RevenueSnapshot } from './revenueEngine';

export interface RevenueContextValue {
  /** Null on the web and while no TTC account is active. */
  engine: RevenueEngine | null;
  snapshot: RevenueSnapshot | null;
}

export const RevenueContext = createContext<RevenueContextValue>({ engine: null, snapshot: null });

export const useRevenue = () => useContext(RevenueContext);
