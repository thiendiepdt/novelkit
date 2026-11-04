import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useActiveTtcAccount } from '../hooks/useActiveTtcAccount';
import { RevenueContext } from './revenueContextDefs';
import { RevenueEngine } from './revenueEngine';

const noSubscribe = () => () => {};
const noSnapshot = () => null;

/**
 * Revenue of the active TTC account for the whole app (the header ticker): one
 * `RevenueEngine` per account, replaced when the account changes.
 */
export function RevenueProvider({ children }: { children: ReactNode }) {
  const account = useActiveTtcAccount();
  const [engine, setEngine] = useState<RevenueEngine | null>(null);
  const [engineFor, setEngineFor] = useState<string | null>(null);
  if (engineFor !== account) {
    setEngineFor(account);
    setEngine(account ? new RevenueEngine(account) : null);
  }

  useEffect(() => {
    if (!engine) return;
    engine.start();
    return () => engine.stop();
  }, [engine]);

  const snapshot = useSyncExternalStore(engine?.subscribe ?? noSubscribe, engine?.getSnapshot ?? noSnapshot);
  return <RevenueContext.Provider value={{ engine, snapshot }}>{children}</RevenueContext.Provider>;
}
