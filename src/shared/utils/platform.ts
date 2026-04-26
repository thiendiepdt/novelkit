/**
 * Platform detection utilities for NovelKit.
 *
 * Detects whether the app is running inside a Tauri desktop window
 * or in a regular browser. This enables conditional feature loading
 * (e.g., native file dialogs, system tray, auto-update).
 */

/**
 * Check if the app is running inside a Tauri desktop environment.
 * Uses the `__TAURI_INTERNALS__` global injected by the Tauri runtime.
 *
 * @example
 * ```ts
 * if (isTauri()) {
 *   const { open } = await import('@tauri-apps/plugin-dialog');
 *   const file = await open({ filters: [{ name: 'Text', extensions: ['txt'] }] });
 * }
 * ```
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Get the current platform type.
 */
export function getPlatform(): 'desktop' | 'web' {
  return isTauri() ? 'desktop' : 'web';
}
