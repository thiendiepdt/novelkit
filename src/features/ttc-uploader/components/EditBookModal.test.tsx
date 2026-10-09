import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsProvider } from '@/features/settings/context/SettingsContext';
import { SettingsModalProvider } from '@/features/settings/context/SettingsModalContext';
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
  <select name="category"><option value="Đô thị" selected>Đô thị</option><option value="Huyền huyễn">Huyền huyễn</option></select>
  <select name="sub_categories"><option value="Cơ Trí" selected>Cơ Trí</option><option value="Kiêu Ngạo">Kiêu Ngạo</option></select>
  <select name="sub_categories"><option value="Đô Thị Dị Năng" selected>Đô Thị Dị Năng</option></select>
  <select name="sub_categories"><option value="Sảng Văn" selected>Sảng Văn</option></select>
  <textarea name="description">Giới thiệu cũ.</textarea>
  <input type="radio" name="status" value="ongoing" checked>
</form></body></html>`;

const QIDIAN_PAGE = `<html><script id="vite-plugin-ssr_pageContext" type="application/json">${JSON.stringify({
  pageContext: {
    pageProps: {
      pageData: {
        gender: 'male',
        bookInfo: { bookName: '高考觉醒帝骑', authorName: '看我壹掵通关', desc: '赵明穿越了。', chanName: '都市' },
      },
    },
  },
})}</script></html>`;

const AI_REPLY = JSON.stringify({
  title: 'Thi Đại Học Thức Tỉnh Đế Kỵ',
  author: 'Khán Ngã Nhất Mệnh Thông Quan',
  gender: 'Nam',
  category: 'Huyền huyễn',
  tinh_cach: 'Kiêu Ngạo',
  boi_canh: '',
  luu_phai: 'Sảng Văn',
  description: 'Triệu Minh xuyên không.',
});

const callsOf = (cmd: string) => invokeMock.mock.calls.filter((c) => c[0] === cmd);

type Handlers = Partial<Record<string, (args: Record<string, unknown>) => unknown>>;

/** `ttc_upload_cover` runs once per entry of `uploadOutcomes`: a string rejects with it (as Rust commands do), null succeeds. */
function mockBackend(uploadOutcomes: (string | null)[] = [null], overrides: Handlers = {}) {
  let attempt = 0;
  const handlers: Handlers = {
    ttc_fetch_html: () => EDIT_PAGE,
    ttc_read_local_file: () => [1, 2, 3],
    ttc_upload_cover: () => {
      const outcome = uploadOutcomes[attempt++];
      if (outcome) throw outcome;
      return 'ok';
    },
    source_fetch_text: () => QIDIAN_PAGE,
    source_fetch_image: () => ({ bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' }),
    ai_generate_json: () => AI_REPLY,
    ...overrides,
  };
  invokeMock.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
    const handler = handlers[cmd];
    if (!handler) throw new Error(`unexpected invoke ${cmd}`);
    return handler(args ?? {});
  });
}

function setAiKey(apiKey: string) {
  localStorage.setItem('nk_global_settings', JSON.stringify({ ai: { provider: 'gemini', gemini: { apiKey } } }));
}

function renderModal() {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(
    <SettingsProvider>
      <SettingsModalProvider>
        <EditBookModal bookId={27364} onClose={onClose} onSuccess={onSuccess} />
      </SettingsModalProvider>
    </SettingsProvider>,
  );
  return { onClose, onSuccess };
}

const field = (name: string) => document.querySelector(`#editBookForm [name="${name}"]`) as HTMLInputElement;

async function pickAndCropCover() {
  fireEvent.click(await screen.findByRole('button', { name: /Đổi ảnh bìa/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cắt xong' }));
}

describe('EditBookModal cover upload', () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:picked');
    URL.revokeObjectURL = vi.fn();
  });

  it('uploads the cropped cover, stays open, and refreshes the list when closed', async () => {
    mockBackend([null]);
    const { onSuccess, onClose } = renderModal();

    await pickAndCropCover();

    expect(await screen.findByText('Đã cập nhật ảnh bìa trên TTC.')).toBeTruthy();
    expect(callsOf('ttc_upload_cover')[0][1]).toEqual({ bookId: 27364, imageBytes: CROPPED, mimeType: 'image/jpeg' });
    // The user may still be editing: nothing closes by itself...
    expect(onSuccess).not.toHaveBeenCalled();
    // ...but the cover is already on TTC, so closing refreshes the list.
    fireEvent.click(screen.getByText('Đóng')); // footer button (the header ✕ carries the same accessible name)
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the real error of a failed upload and retries the same image without cropping again', async () => {
    mockBackend(['HTTP 504 Gateway Timeout', null]);
    renderModal();

    await pickAndCropCover();

    // The reason is visible (not hidden behind the cropper, not replaced by a generic text).
    expect(await screen.findByText(/HTTP 504 Gateway Timeout/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cắt xong' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Thử lại tải ảnh bìa/ }));

    expect(await screen.findByText('Đã cập nhật ảnh bìa trên TTC.')).toBeTruthy();
    const uploads = callsOf('ttc_upload_cover');
    expect(uploads).toHaveLength(2);
    expect(uploads[1][1]).toEqual({ bookId: 27364, imageBytes: CROPPED, mimeType: 'image/jpeg' });
    // No second file pick or crop was needed.
    expect(callsOf('ttc_read_local_file')).toHaveLength(1);
  });

  it('keeps offering the retry while the upload keeps failing', async () => {
    mockBackend(['HTTP 504 Gateway Timeout', 'HTTP 502 Bad Gateway']);
    renderModal();

    await pickAndCropCover();
    fireEvent.click(await screen.findByRole('button', { name: /Thử lại tải ảnh bìa/ }));

    expect(await screen.findByText(/HTTP 502 Bad Gateway/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Thử lại tải ảnh bìa/ })).toBeTruthy();
  });

  it('downloads the cover from the source site and sends it through the cropper', async () => {
    mockBackend([null]);
    renderModal();

    fireEvent.click(await screen.findByRole('button', { name: /Tải ảnh bìa từ nguồn/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cắt xong' }));

    expect(await screen.findByText('Đã cập nhật ảnh bìa trên TTC.')).toBeTruthy();
    // Read from the link of the story, cover fetched from what the source page lists.
    expect(callsOf('source_fetch_text')[0][1]).toEqual({ url: 'https://m.qidian.com/book/1049511732/' });
    expect(callsOf('source_fetch_image')[0][1]).toEqual({ url: 'https://bookcover.yuewen.com/qdbimg/349573/1049511732/600' });
    expect(callsOf('ttc_read_local_file')).toHaveLength(0);
    expect(callsOf('ttc_upload_cover')[0][1]).toEqual({ bookId: 27364, imageBytes: CROPPED, mimeType: 'image/jpeg' });
  });

  it('reports a cover that cannot be downloaded from the source', async () => {
    mockBackend([null], {
      source_fetch_image: () => {
        throw 'Không tải được ảnh bìa sau 2 lần thử: hết thời gian chờ';
      },
    });
    renderModal();

    fireEvent.click(await screen.findByRole('button', { name: /Tải ảnh bìa từ nguồn/ }));

    expect((await screen.findByRole('alert')).textContent).toBe('Không tải được ảnh bìa sau 2 lần thử: hết thời gian chờ');
    expect(screen.queryByRole('button', { name: 'Cắt xong' })).toBeNull();
  });
});

describe('EditBookModal AI re-fill', () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:picked');
    URL.revokeObjectURL = vi.fn();
  });

  it('fills the editable fields again from the source and offers the new title separately', async () => {
    setAiKey('KEY');
    mockBackend();
    const { onSuccess } = renderModal();

    fireEvent.click(await screen.findByRole('button', { name: /AI điền lại/ }));

    await waitFor(() => expect(field('description').value).toBe('Triệu Minh xuyên không.'));
    expect(screen.getByDisplayValue('Huyền huyễn')).toBeTruthy();
    const selects = Array.from(document.querySelectorAll('#editBookForm select')) as HTMLSelectElement[];
    // Category, then the three sub-categories: the one the model left empty keeps its old value.
    expect(selects.map((s) => s.value)).toEqual(['Huyền huyễn', 'Kiêu Ngạo', 'Đô Thị Dị Năng', 'Sảng Văn']);
    expect(await screen.findByText(/Đã điền lại từ Qidian/)).toBeTruthy();
    expect(screen.getByText(/giữ giá trị cũ/).textContent).toMatch(/AI chưa chọn được: Bối cảnh/);

    // The title is never changed quietly.
    expect(screen.getByText('Thi Đại Học Thức Tỉnh Decade')).toBeTruthy();
    expect(screen.getByText('“Thi Đại Học Thức Tỉnh Đế Kỵ”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dùng tên này' }));
    expect(screen.getByText('Thi Đại Học Thức Tỉnh Đế Kỵ')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dùng tên này' })).toBeNull();

    // Nothing was saved to TTC yet.
    expect(callsOf('ttc_submit_multipart')).toHaveLength(0);
    expect(onSuccess).not.toHaveBeenCalled();

    const prompt = (callsOf('ai_generate_json')[0][1] as { request: { user: string } }).request.user;
    expect(prompt).toContain('Loại truyện đăng: Truyện Dịch');
    expect(prompt).toContain('Tên truyện (tiếng Trung): 高考觉醒帝骑');
  });

  it('points to the AI settings when no API key is configured', async () => {
    mockBackend();
    renderModal();

    const button = (await screen.findByRole('button', { name: /AI điền lại/ })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Mở cài đặt AI' })).toBeTruthy();
    expect(callsOf('ai_generate_json')).toHaveLength(0);
  });

  it('shows the error and keeps the form as it was when the source cannot be read', async () => {
    setAiKey('KEY');
    mockBackend([null], {
      source_fetch_text: () => {
        throw 'Không tải được dữ liệu từ m.qidian.com: hết thời gian chờ';
      },
    });
    renderModal();

    fireEvent.click(await screen.findByRole('button', { name: /AI điền lại/ }));

    expect((await screen.findByRole('alert')).textContent).toBe('Không tải được dữ liệu từ m.qidian.com: hết thời gian chờ');
    expect(field('description').value).toBe('Giới thiệu cũ.');
    expect(callsOf('ai_generate_json')).toHaveLength(0);
  });
});
