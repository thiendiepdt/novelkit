import { isTauri } from './platform';

/** Only web pages: a link coming from data must never launch anything else. */
export function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Open a web page in the user's default browser (desktop: through the shell plugin, a
 * link in the webview would open inside the app window; web: a new tab).
 */
export async function openExternal(url: string): Promise<void> {
  if (!isWebUrl(url)) return;
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
