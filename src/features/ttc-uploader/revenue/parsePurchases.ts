/**
 * One page of TTC's "Tài chính" notifications (`/thong-bao?type=purchase`), newest first:
 *
 *   <div class="notify-item … filter-item" data-type="purchase" id="notif-1793719900176_kjua"
 *        onclick="handleNotificationClick(event, '1793719900176_kjua', '/truyen/27412')">
 *     <div class="notify-content">💰 Nhận <b>90 hoa</b> từ lượt mua chương 59 - <b>Tên truyện</b></div>
 *     <span class="notify-time">2 phút trước</span>
 *
 * Income comes in three wordings: "lượt mua chương 59", a bulk sale "lượt mua 10 chương"
 * and a gift "Nhận được <b>180,000 hoa</b> tặng cho <b>Tên truyện</b>" (amounts use either
 * separator). Anything received counts, so a new wording is not silently lost.
 *
 * The page only shows a relative time; the id starts with the creation time in epoch ms
 * (it matches the `time` of `/api/notifications/latest` to a few ms), which is what dates
 * every entry. The tab also lists spending ("Bạn đã đề cử … Trừ 10.000 hoa"): those
 * entries are kept (they still date the page) but carry no income.
 */

/** One chapter, a bulk sale ("combo") of several, or a gift. */
export type IncomeKind = 'single' | 'bulk' | 'gift';

export interface PurchaseIncome {
  hoa: number;
  storyId: string;
  title: string;
  /** The chapter of a single-chapter sale. */
  chapter: number | null;
  kind: IncomeKind;
}

export interface NotificationEntry {
  id: string;
  /** Creation time, epoch ms. */
  ts: number;
  /** Set for what the account received ("Nhận N hoa …"), null for spending. */
  income: PurchaseIncome | null;
}

export interface PurchasePage {
  entries: NotificationEntry[];
  /** Highest page number of the pagination (null when the page has none). */
  lastPage: number | null;
}

const INCOME_RE = /Nhận(?:\s+được)?\s+([\d.,]+)\s*hoa/i;
const CHAPTER_RE = /lượt mua chương\s*(\d+)/i;
const BULK_RE = /lượt mua\s+[\d.,]+\s+chương/i;
const GIFT_RE = /hoa\s+tặng cho/i;

function parseEntry(el: Element): NotificationEntry | null {
  const id = (el.getAttribute('id') || '').replace(/^notif-/, '');
  const ms = /^(\d{12,})_/.exec(id);
  if (!ms) return null;
  const ts = Number(ms[1]);

  const content = el.querySelector('.notify-content');
  const text = (content?.textContent || '').replace(/\s+/g, ' ').trim();
  const m = INCOME_RE.exec(text);
  if (!m) return { id, ts, income: null };

  const chapter = CHAPTER_RE.exec(text);
  const bolds = Array.from(content?.querySelectorAll('b') || []);
  const title = (bolds.length > 1 ? bolds[bolds.length - 1].textContent : text.split(' - ').slice(1).join(' - ')) || '';
  const link = /\/truyen\/(\d+)/.exec(el.getAttribute('onclick') || '');
  return {
    id,
    ts,
    income: {
      hoa: Number(m[1].replace(/[.,]/g, '')),
      storyId: link ? link[1] : title.trim(),
      title: title.trim(),
      chapter: chapter ? Number(chapter[1]) : null,
      kind: GIFT_RE.test(text) ? 'gift' : BULK_RE.test(text) ? 'bulk' : 'single',
    },
  };
}

export function parsePurchasePage(html: string): PurchasePage {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const entries = Array.from(doc.querySelectorAll('.notify-item[id^="notif-"]'))
    .map(parseEntry)
    .filter((e): e is NotificationEntry => e !== null);

  // Numbered links only: the "›" link of the last page points one page further.
  const pages = Array.from(doc.querySelectorAll('a.page-link[href*="page="]'))
    .filter((a) => /^\d+$/.test((a.textContent || '').trim()))
    .map((a) => Number(/[?&]page=(\d+)/.exec(a.getAttribute('href') || '')?.[1]))
    .filter((n) => Number.isFinite(n) && n > 0);
  return { entries, lastPage: pages.length ? Math.max(...pages) : null };
}
