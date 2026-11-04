import { describe, it, expect } from 'vitest';
import { parsePurchasePage } from './parsePurchases';

/** The markup of TTC's /thong-bao?type=purchase (one item per notification). */
const item = (id: string, content: string, story = '27412') => `
  <div class="notify-item notify-read filter-item" data-type="purchase" id="notif-${id}"
       onclick="handleNotificationClick(event, '${id}', '/truyen/${story}')" style="cursor: pointer;">
    <div class="me-3"><input class="form-check-input notif-checkbox" type="checkbox" value="${id}"></div>
    <div class="notif-icon bg-purchase"><i class="fa-solid fa-coins"></i></div>
    <div class="flex-grow-1 overflow-hidden">
      <div class="d-flex justify-content-between align-items-center">
        <div class="notify-content text-dark">${content}</div>
        <span class="notify-time ms-3 text-muted small text-nowrap">2 phút trước</span>
      </div>
    </div>
  </div>`;

const page = (items: string, pages = [1, 2, 3]) => `<html><body>
  <div class="list-group list-group-flush" id="notifList">${items}</div>
  <ul class="pagination">
    <li class="page-item disabled"><a class="page-link" href="/thong-bao?page=0&amp;type=purchase">‹</a></li>
    ${pages.map((p) => `<li class="page-item"><a class="page-link" href="/thong-bao?page=${p}&amp;type=purchase">${p}</a></li>`).join('')}
    <li class="page-item"><a class="page-link" href="/thong-bao?page=${Math.max(...pages) + 1}&amp;type=purchase"><i class="fa-solid fa-chevron-right"></i></a></li>
  </ul></body></html>`;

describe('parsePurchasePage', () => {
  it('reads amount, chapter, story and the time from the id', () => {
    const { entries, lastPage } = parsePurchasePage(
      page(
        item('1793719900176_kjua', '💰 Nhận <b>90 hoa</b> từ lượt mua chương 59 - <b>Tận Thế: Người Khác Cầu Sinh - Bản 2</b>') +
          item('1793719689272_xc20', '💰 Nhận <b>1.200 hoa</b> từ lượt mua chương 979 - <b>Thỉnh Tiên Sinh Cứu Ta</b>', '27203'),
        [1, 2, 98],
      ),
    );
    expect(lastPage).toBe(98);
    expect(entries).toEqual([
      {
        id: '1793719900176_kjua',
        ts: 1793719900176,
        income: { hoa: 90, storyId: '27412', title: 'Tận Thế: Người Khác Cầu Sinh - Bản 2', chapter: 59, kind: 'single' },
      },
      {
        id: '1793719689272_xc20',
        ts: 1793719689272,
        income: { hoa: 1200, storyId: '27203', title: 'Thỉnh Tiên Sinh Cứu Ta', chapter: 979, kind: 'single' },
      },
    ]);
  });

  it('counts bulk sales and gifts, with either thousands separator', () => {
    const { entries } = parsePurchasePage(
      page(
        item('1793719900176_aaaa', '💰 Nhận <b>96,696 hoa</b> từ lượt mua 1343 chương - <b>Thỉnh Tiên Sinh Cứu Ta</b>', '27203') +
          item('1793719689272_bbbb', '🎁 Nhận được <b>180,000 hoa</b> tặng cho <b>Thỉnh Tiên Sinh Cứu Ta</b>', '27203'),
      ),
    );
    expect(entries.map((e) => e.income)).toEqual([
      { hoa: 96696, storyId: '27203', title: 'Thỉnh Tiên Sinh Cứu Ta', chapter: null, kind: 'bulk' },
      { hoa: 180000, storyId: '27203', title: 'Thỉnh Tiên Sinh Cứu Ta', chapter: null, kind: 'gift' },
    ]);
  });

  it('keeps spending in the list (it dates the page) without income', () => {
    const { entries } = parsePurchasePage(
      page(item('1793099200202_ab12', '🏆 Bạn đã đề cử <b>Ác Nữ</b> lên Bảng Vàng! Trừ 10.000 hoa, số dư: 5.000 hoa')),
    );
    expect(entries).toEqual([{ id: '1793099200202_ab12', ts: 1793099200202, income: null }]);
  });

  it('handles an empty page without pagination', () => {
    expect(parsePurchasePage('<html><body><div id="notifList"></div></body></html>')).toEqual({ entries: [], lastPage: null });
  });
});
