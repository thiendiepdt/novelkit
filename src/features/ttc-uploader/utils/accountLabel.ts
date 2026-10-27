import type { TtcAccountInfo } from '../types';

/** Name to show for an account: its display name, else the username. */
export const accountLabel = (a: TtcAccountInfo) => a.displayName || a.username || 'Tài khoản cũ';
