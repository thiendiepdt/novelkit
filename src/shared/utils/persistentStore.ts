import { isTauri } from './platform';

/**
 * Where the app keeps what it remembers between runs (settings, AI keys).
 *
 * - Desktop: `user_data.json` in the app data dir, owned by the Rust `user_store` module.
 *   `initPersistentStore()` loads it into memory before the first render, so reads stay
 *   synchronous; every change is sent to Rust, one request after the other.
 * - Web (and before init, e.g. in tests): the browser's localStorage.
 *
 * The first desktop run after this change copies every localStorage key into the file.
 * localStorage itself is left untouched, so an older app version still finds its data.
 */

/** In-memory copy of the desktop store; null = use localStorage. */
let memory: Map<string, string> | null = null;
/** Desktop writes, in call order: a later write must never land before an earlier one. */
let pending: Promise<unknown> = Promise.resolve();

function readLocalStorage(): Record<string, string> {
  const items: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      const value = localStorage.getItem(key);
      if (value !== null) items[key] = value;
    }
  } catch {
    // localStorage disabled: nothing to migrate
  }
  return items;
}

/**
 * Load the desktop store (migrating localStorage on its first run). Resolves on the web
 * without doing anything. A failure leaves the app on localStorage rather than blocking
 * startup.
 */
export async function initPersistentStore(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    let items = await invoke<Record<string, string> | null>('user_store_load');
    if (items === null) {
      const fromWebview = readLocalStorage();
      const imported = await invoke<boolean>('user_store_import', { items: fromWebview });
      // Another window may have imported first: its file wins.
      items = imported ? fromWebview : ((await invoke<Record<string, string> | null>('user_store_load')) ?? fromWebview);
    }
    memory = new Map(Object.entries(items));
  } catch (e) {
    console.error('User data store unavailable, falling back to localStorage:', e);
    memory = null;
  }
}

function send(command: string, args: Record<string, unknown>) {
  pending = pending
    .then(async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke(command, args);
    })
    .catch((e) => console.error(`${command} failed:`, e));
}

export function storeGet(key: string): string | null {
  if (memory) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storeSet(key: string, value: string): void {
  if (memory) {
    if (memory.get(key) === value) return;
    memory.set(key, value);
    send('user_store_set', { key, value });
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be full or disabled
  }
}

export function storeRemove(key: string): void {
  if (memory) {
    if (!memory.has(key)) return;
    memory.delete(key);
    send('user_store_remove', { key });
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Resolves once every desktop write sent so far has been handled (tests, shutdown). */
export function flushPersistentStore(): Promise<unknown> {
  return pending;
}

/** Test helper: back to the uninitialized (localStorage) state. */
export function resetPersistentStoreForTests(): void {
  memory = null;
  pending = Promise.resolve();
}
