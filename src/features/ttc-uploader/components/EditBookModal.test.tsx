import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditBookModal } from './EditBookModal';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => 'C:/covers/new.jpg') }));

// The real cropper needs a canvas; here "cropping" hands back fixed bytes.
const CROPPED = [0xff, 0xd8, 0xff, 0xe0];
vi.mock('./CoverCropperModal', () => ({
  CoverCropperModal: ({ onCropComplete }: { onCropComplete: (bytes: number[], mime: string) => Promise<void> }) => (
    <button onClick={() => onCropComplete(CROPPED, 'image/jpeg')}>Cắt xong</button>
  ),
}));

const EDIT_PAGE = `<html><body>
<form id="storyForm" action="/sua-truyen/27364" method="POST">
  <input type="hidden" name="_csrf" value="tok123">
  <input name="title" value="Thi Đại Học Thức Tỉnh Decade">
  <input name="chinese_title" value="高考觉醒帝骑">
  <input name="chinese_link" value="https://www.qidian.com/book/1049511732/">
  <input type="radio" name="gender" value="Nam" checked>
  <input type="hidden" name="type" value="truyen-dich">
  <input type="radio" name="story_length" value="Truyện dài" checked>
  <input name="author" value="Khán Ngã Nhất Mệnh Thông Quan">
  <input name="author_original" value="看我壹掵通关">
  <select name="category"><option value="Đô thị" selected>Đô thị</option></select>
  <select name="sub_categories"><option value="Cơ Trí" selected>Cơ Trí</option></select>
  <select name="sub_categories"><option value="Đô Thị Dị Năng" selected>Đô Thị Dị Năng</option></select>
  <select name="sub_categories"><option value="Sảng Văn" selected>Sảng Văn</option></select>
  <textarea name="description">Giới thiệu.</textarea>
  <input type="radio" name="status" value="ongoing" checked>
</form></body></html>`;

const callsOf = (cmd: string) => invokeMock.mock.calls.filter((c) => c[0] === cmd);

/** `uploadCover` runs once per entry: a string rejects with it (as Rust commands do), null succeeds. */
function mockBackend(uploadOutcomes: (string | null)[]) {
  let attempt = 0;
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'ttc_fetch_html') return EDIT_PAGE;
    if (cmd === 'ttc_read_local_file') return [1, 2, 3];
    if (cmd === 'ttc_upload_cover') {
      const outcome = uploadOutcomes[attempt++];
      if (outcome) throw outcome;
      return 'ok';
    }
    throw new Error(`unexpected invoke ${cmd}`);
  });
}

async function pickAndCropCover() {
  fireEvent.click(await screen.findByRole('button', { name: /Đổi ảnh bìa/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cắt xong' }));
}

describe('EditBookModal cover upload', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:picked');
    URL.revokeObjectURL = vi.fn();
  });

  it('uploads the cropped cover and reports success', async () => {
    mockBackend([null]);
    const onSuccess = vi.fn();
    render(<EditBookModal bookId={27364} onClose={vi.fn()} onSuccess={onSuccess} />);

    await pickAndCropCover();

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(callsOf('ttc_upload_cover')[0][1]).toEqual({ bookId: 27364, imageBytes: CROPPED, mimeType: 'image/jpeg' });
  });

  it('shows the real error of a failed upload and retries the same image without cropping again', async () => {
    mockBackend(['HTTP 504 Gateway Timeout', null]);
    const onSuccess = vi.fn();
    render(<EditBookModal bookId={27364} onClose={vi.fn()} onSuccess={onSuccess} />);

    await pickAndCropCover();

    // The reason is visible (not hidden behind the cropper, not replaced by a generic text).
    expect(await screen.findByText(/HTTP 504 Gateway Timeout/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cắt xong' })).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Thử lại tải ảnh bìa/ }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const uploads = callsOf('ttc_upload_cover');
    expect(uploads).toHaveLength(2);
    expect(uploads[1][1]).toEqual({ bookId: 27364, imageBytes: CROPPED, mimeType: 'image/jpeg' });
    // No second file pick or crop was needed.
    expect(callsOf('ttc_read_local_file')).toHaveLength(1);
  });

  it('keeps offering the retry while the upload keeps failing', async () => {
    mockBackend(['HTTP 504 Gateway Timeout', 'HTTP 502 Bad Gateway']);
    render(<EditBookModal bookId={27364} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await pickAndCropCover();
    fireEvent.click(await screen.findByRole('button', { name: /Thử lại tải ảnh bìa/ }));

    expect(await screen.findByText(/HTTP 502 Bad Gateway/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Thử lại tải ảnh bìa/ })).toBeTruthy();
  });
});
