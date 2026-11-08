import { isWebUrl } from '@/shared/utils/openExternal';
import { detectSource, SOURCE_LABELS } from '../sources';

export interface SourceSite {
  /** Short name of the site: "Fanqie", "Qidian", or the host for a site the app does not know. */
  name: string;
  url: string;
}

/** The source site of a story from its "Link tiếng Trung", or null (no link: "Sáng Tác"). */
export function sourceSite(link: string | null | undefined): SourceSite | null {
  const url = (link || '').trim();
  if (!isWebUrl(url)) return null;
  const known = detectSource(url);
  // "Fanqie (番茄小说)" → "Fanqie"
  const name = known ? SOURCE_LABELS[known.source].split(' (')[0] : new URL(url).hostname.replace(/^www\./, '');
  return { name, url };
}
