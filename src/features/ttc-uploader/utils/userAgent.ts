import { isTauri } from '@/shared/utils/platform';

/**
 * Give the Rust side the webview's User-Agent before any TTC request. TTC filters the
 * requests of its upload and create-story pages by User-Agent ("must look like a real
 * browser"), and the webview is the browser engine the TTC login window runs on. Rust keeps
 * a complete browser string as fallback, used when this fails or the webview's string does
 * not look like a browser.
 */
export async function reportWebviewUserAgent(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke<string>('ttc_set_user_agent', { userAgent: navigator.userAgent });
  } catch (e) {
    console.error('Could not report the webview User-Agent:', e);
  }
}
