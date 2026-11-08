import { ExternalLink } from 'lucide-react';
import { Tooltip } from '@/shared/components';
import { openExternal } from '@/shared/utils/openExternal';
import type { TtcStory } from '../types';
import { sourceSite } from '../utils/sourceSite';

/**
 * The source site of a story ("Fanqie", "Qidian", ...) as a small button that opens the
 * book there in the browser. Nothing for a story without a source link ("Sáng Tác").
 */
export function SourceLink({ book }: { book: Pick<TtcStory, 'chinese_link' | 'chinese_title'> }) {
  const site = sourceSite(book.chinese_link);
  if (!site) return null;
  return (
    <Tooltip
      side="top"
      content={
        <span className="flex flex-col gap-0.5">
          {book.chinese_title && <span className="text-text-primary">{book.chinese_title}</span>}
          <span className="text-text-dim break-all">{site.url}</span>
        </span>
      }
    >
      <button
        type="button"
        onClick={() => void openExternal(site.url)}
        aria-label={`Mở trang nguồn trên ${site.name}`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-white/15 bg-white/[0.07] text-[11px] font-semibold text-text-primary/85 hover:text-gold hover:border-gold/50 hover:bg-gold/10 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        {site.name} <ExternalLink size={11} />
      </button>
    </Tooltip>
  );
}
