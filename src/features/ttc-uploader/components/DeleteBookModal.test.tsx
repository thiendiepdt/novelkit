import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { TtcStory } from '../types';
import { BookCard } from './BookCard';
import { DeleteBookModal } from './DeleteBookModal';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));

const makeBook = (overrides: Partial<TtcStory> = {}): TtcStory => ({
  id: 27364,
  title: 'Thi Đại Học Thức Tỉnh Decade',
  author: 'Khán Ngã Nhất Mệnh Thông Quan',
  poster: '/stories/27364/poster.jpg',
  category: 'Đô thị',
  status: 'ongoing',
  total_chapters: 0,
  latest_chapter_title: null,
  last_chap_updated: null,
  views: 0,
  follows: 0,
  approved: false,
  ...overrides,
});

describe('BookCard approval state', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue('data:image/png;base64,AAAA'); // ttc_proxy_image
  });

  const renderCard = (book: TtcStory) => {
    const onDelete = vi.fn();
    render(<BookCard book={book} onEdit={vi.fn()} onResync={vi.fn()} onDelete={onDelete} />);
    return { onDelete };
  };

  it('marks a story that is waiting for approval and offers to delete it', () => {
    const book = makeBook({ approved: false });
    const { onDelete } = renderCard(book);

    expect(screen.getByText('Chờ duyệt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Xóa/ }));
    expect(onDelete).toHaveBeenCalledWith(book);
  });

  it('shows neither the badge nor the delete button for an approved story', () => {
    renderCard(makeBook({ approved: true, total_chapters: 266 }));

    expect(screen.queryByText('Chờ duyệt')).toBeNull();
    expect(screen.queryByRole('button', { name: /Xóa/ })).toBeNull();
  });

  it('treats a missing approval flag as approved, like the site does', () => {
    renderCard(makeBook({ approved: undefined }));
    expect(screen.queryByText('Chờ duyệt')).toBeNull();
    expect(screen.queryByRole('button', { name: /Xóa/ })).toBeNull();
  });
});

describe('DeleteBookModal', () => {
  // Block body on purpose: a function returned from beforeEach is run as teardown, and
  // mockReset() returns the mock itself.
  beforeEach(() => {
    invokeMock.mockReset();
  });

  const renderModal = (book = makeBook()) => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    render(<DeleteBookModal book={book} onClose={onClose} onDeleted={onDeleted} />);
    return { book, onClose, onDeleted };
  };

  it('sends nothing until the user confirms', () => {
    const { onClose } = renderModal();

    expect(screen.getByText('“Thi Đại Học Thức Tỉnh Decade”')).toBeTruthy();
    expect(screen.getByText(/không hoàn tác được/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(onClose).toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('deletes the story on confirm and passes on the confirmation of TTC', async () => {
    invokeMock.mockResolvedValue('✅ Đã xóa truyện thành công!');
    const { book, onDeleted } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Xóa truyện/ }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(book, '✅ Đã xóa truyện thành công!'));
    expect(invokeMock).toHaveBeenCalledWith('ttc_delete_story', { bookId: 27364 });
  });

  it('shows the reason and stays open when TTC refuses', async () => {
    // Rust commands reject with a bare string, not an Error.
    invokeMock.mockImplementation(async () => {
      throw '❌ Không tìm thấy truyện trên hệ thống!';
    });
    const { onDeleted } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Xóa truyện/ }));

    expect((await screen.findByRole('alert')).textContent).toBe('❌ Không tìm thấy truyện trên hệ thống!');
    expect(onDeleted).not.toHaveBeenCalled();
    // The button is usable again for another try.
    expect((screen.getByRole('button', { name: /Xóa truyện/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('warns about existing chapters', () => {
    renderModal(makeBook({ total_chapters: 12 }));
    expect(screen.getByText(/Truyện đang có 12 chương/)).toBeTruthy();
  });
});
