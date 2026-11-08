import { useCallback } from 'react';
import { usePersistentState } from '@/shared/hooks/usePersistentState';
import type { MeoLink } from './types';

/**
 * The Mèo Truyện book each TTC story was imported as (TTC story ids are site-wide, so no
 * account in the key). Owned by one component and passed down: `usePersistentState` does
 * not keep two instances of a key in step.
 */
export function useMeoTruyenLinks() {
  const [links, setLinks] = usePersistentState<Record<number, MeoLink>>('nk_meotruyen_links', {});
  const saveLink = useCallback((ttcId: number, link: MeoLink) => setLinks((prev) => ({ ...prev, [ttcId]: link })), [setLinks]);
  return { links, saveLink };
}
