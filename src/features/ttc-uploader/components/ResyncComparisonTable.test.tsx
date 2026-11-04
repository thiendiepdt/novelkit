import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResyncComparisonTable } from './ResyncComparisonTable';
import type { ParsedChapter, TtcChapter } from '../types';

const local = (index: number, title = `Chương ${index}`): ParsedChapter => ({
  index,
  title,
  content: '',
  word_count: 1000,
  file_name: 'local_folder',
});
const remote = (chapterNumber: number): TtcChapter => ({
  chapterNumber,
  title: `Chương ${chapterNumber}`,
  wordCount: 1000,
  views: 0,
  status: null,
  chapter_price: 0,
  last_chap_updated: null,
});
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('ResyncComparisonTable', () => {
  beforeAll(() => {
    // jsdom has no layout: the auto-scroll to the first changed row is a no-op here.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('recommends appending when only new chapters exist', () => {
    const onAutoSelectMode = vi.fn();
    render(
      <ResyncComparisonTable
        localChapters={range(1, 5).map(i => local(i))}
        remoteChapters={range(1, 3).map(remote)}
        onAutoSelectMode={onAutoSelectMode}
      />,
    );
    expect(screen.getByText(/Đề xuất: Tiếp nối \(Append\) để thêm 2 chương mới/)).toBeTruthy();
  });

  it('opens on the page of the first changed chapter and recommends a range from it', () => {
    const localChapters = range(1, 150).map(i => local(i, i === 120 ? 'Chương 120 (sửa)' : `Chương ${i}`));
    render(
      <ResyncComparisonTable localChapters={localChapters} remoteChapters={range(1, 150).map(remote)} onAutoSelectMode={vi.fn()} />,
    );
    expect(screen.getByText(/Phát hiện thay đổi từ chương 120/)).toBeTruthy();
    // 100 rows per page: chapter 120 is on the second page.
    expect(screen.getByText(/Hiện 101–150 \/ 150/)).toBeTruthy();
  });

  it('starts on the first page when everything matches', () => {
    render(
      <ResyncComparisonTable
        localChapters={range(1, 150).map(i => local(i))}
        remoteChapters={range(1, 150).map(remote)}
        onAutoSelectMode={vi.fn()}
      />,
    );
    expect(screen.getByText(/Mọi chương đều khớp/)).toBeTruthy();
    expect(screen.getByText(/Hiện 1–100 \/ 150/)).toBeTruthy();
  });

  it('passes the recommended range to the parent', () => {
    const onAutoSelectMode = vi.fn();
    render(
      <ResyncComparisonTable
        localChapters={[local(1), local(2, 'Khác'), local(3)]}
        remoteChapters={range(1, 3).map(remote)}
        onAutoSelectMode={onAutoSelectMode}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Áp dụng|Chọn|Dùng/ }));
    expect(onAutoSelectMode).toHaveBeenCalledWith('range', 2, 3);
  });
});
