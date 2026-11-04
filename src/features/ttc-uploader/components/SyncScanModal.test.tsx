import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncScanModal } from './SyncScanModal';
import type { SyncRow, SyncRowState } from '../hooks/useSyncScan';
import type { TtcStory, UploadOptions } from '../types';

const h = vi.hoisted(() => ({
  rows: [] as SyncRow[],
  enqueue: vi.fn((ids: number[]) => ids.length),
  runScan: vi.fn(),
}));
vi.mock('../hooks/useSyncScan', () => ({
  useSyncScan: () => ({
    rows: h.rows,
    loadingBooks: false,
    checking: false,
    checkedCount: h.rows.length,
    noFolderCount: 0,
    error: null,
    jobIds: {},
    runScan: h.runScan,
    enqueue: h.enqueue,
  }),
}));
vi.mock('@/shared/context/UploadQueueContext', () => ({ useUploadQueueContext: () => ({ jobs: [] }) }));

const options = (count: number) => ({ chapters: Array.from({ length: count }, () => ({})) }) as unknown as UploadOptions;
const row = (id: number, state: SyncRowState): SyncRow => ({
  book: { id, title: `Truyện ${id}`, total_chapters: 10 } as TtcStory,
  state,
});

describe('SyncScanModal', () => {
  beforeAll(() => {
    // jsdom has no layout: the list scrolls to the top on a tab change.
    Element.prototype.scrollTo = vi.fn();
  });

  beforeEach(() => {
    h.enqueue.mockClear();
    h.rows = [
      row(1, { kind: 'new', options: options(2), from: 11, to: 12 }),
      row(2, { kind: 'changed', options: options(3), fromIndex: 8, toIndex: 10, newCount: 0, firstDiff: { local: 'a', remote: 'b' } }),
      row(3, { kind: 'synced', localCount: 10, remoteExtra: 0 }),
      row(4, { kind: 'invalid', reason: 'Folder không có file .txt' }),
      row(5, { kind: 'new', options: options(1), from: 11, to: 11 }),
    ];
  });

  const tab = (name: RegExp) => screen.getByRole('button', { name });

  it('counts each verdict in its tab and shows only that verdict', () => {
    render(<SyncScanModal onClose={vi.fn()} onOpenBook={vi.fn()} />);
    expect(tab(/^Tất cả/).textContent).toBe('Tất cả5');
    expect(tab(/^Chương mới/).textContent).toBe('Chương mới2');
    expect(tab(/^Chưa đồng bộ/).textContent).toBe('Chưa đồng bộ1');
    expect(tab(/^Đã đồng bộ/).textContent).toBe('Đã đồng bộ1');
    expect(tab(/^Lỗi/).textContent).toBe('Lỗi1');

    fireEvent.click(tab(/^Lỗi/));
    expect(tab(/^Lỗi/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Truyện 4')).toBeTruthy();
    expect(screen.queryByText('Truyện 1')).toBeNull();
    // Nothing to upload in this tab.
    expect(screen.queryByText(/Chọn tất cả/)).toBeNull();
  });

  it('selects all within the tab only, and uploads the picks of every tab', () => {
    render(<SyncScanModal onClose={vi.fn()} onOpenBook={vi.fn()} />);
    // Stories with only new chapters are preselected.
    expect(tab(/^Upload/).textContent).toContain('Upload (2)');

    fireEvent.click(tab(/^Chưa đồng bộ/));
    fireEvent.click(screen.getByLabelText('Chọn tất cả truyện trong mục này'));
    expect(tab(/^Upload/).textContent).toContain('Upload (3)');

    fireEvent.click(tab(/^Chương mới/));
    fireEvent.click(screen.getByLabelText('Chọn tất cả truyện trong mục này'));
    expect(tab(/^Upload/).textContent).toContain('Upload (1)');

    fireEvent.click(tab(/^Upload/));
    expect(h.enqueue).toHaveBeenCalledWith([2]);
  });
});
