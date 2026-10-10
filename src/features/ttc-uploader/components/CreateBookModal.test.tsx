import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsProvider } from '@/features/settings/context/SettingsContext';
import { SettingsModalProvider } from '@/features/settings/context/SettingsModalContext';
import { CreateBookModal } from './CreateBookModal';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

const CREATE_PAGE = `<html><body>
<form id="storyForm" action="/dang-truyen" method="POST">
  <input type="hidden" name="_csrf" value="tok123">
  <select name="category" required>
    <option value="" selected disabled hidden>Vui lòng chọn thể loại</option>
    <option value="Tiên hiệp">Tiên hiệp</option>
    <option value="Huyền huyễn">Huyền huyễn</option>
  </select>
  <select name="sub_categories"><option value="" selected>-</option><option value="Cơ Trí">Cơ Trí</option></select>
  <select name="sub_categories"><option value="" selected>-</option><option value="Tây Phương Kỳ Huyền">Tây Phương Kỳ Huyền</option></select>
  <select name="sub_categories"><option value="" selected>-</option><option value="Xuyên Không">Xuyên Không</option></select>
</form>
<ol><li>Không được quảng cáo.</li></ol>
<script>window.PAGE_DATA = { currentDisplayName: "Thương Hải Hoành Lưu", isEdit: false };</script>
</body></html>`;

const QIDIAN_PAGE = `<html><script id="vite-plugin-ssr_pageContext" type="application/json">${JSON.stringify({
  pageContext: {
    pageProps: {
      pageData: {
        gender: 'male',
        bookInfo: {
          bookName: '诡秘之主',
          authorName: '爱潜水的乌贼',
          desc: '蒸汽与机械的浪潮中，谁能触及非凡？<br>我从诡秘中醒来。',
          chanName: '玄幻',
          subCateName: '异世大陆',
        },
      },
    },
  },
})}</script></html>`;

const FANQIE_PAGE = `<html><script>window.__INITIAL_STATE__=${JSON.stringify({
  page: {
    bookName: '部族荣光',
    authorName: '丧狐',
    abstract: '第一段。\n第二段。',
    thumbUri: 'https://p3-novel-sign.byteimg.com/novel-pic/abc~tplv-resize:225:300.image?x-signature=s',
    categoryV2: JSON.stringify([{ Name: '传统玄幻', Gender: 1 }]),
  },
})};</script></html>`;

const AI_REPLY = JSON.stringify({
  title: 'quỷ bí chi chủ',
  author: 'ái tiềm thủy đích ô tặc',
  gender: 'Nam',
  category: 'Huyền huyễn',
  tinh_cach: 'Cơ Trí',
  boi_canh: 'Tây Phương Kỳ Huyền',
  luu_phai: 'Xuyên Không',
  description: 'Trong làn sóng hơi nước và máy móc.\nTa tỉnh lại từ quỷ bí.',
});

type Handlers = Partial<Record<string, (args: Record<string, unknown>) => unknown>>;

function mockBackend(overrides: Handlers = {}) {
  const handlers: Handlers = {
    ttc_fetch_html: (args) =>
      String(args.path).startsWith('/api/check-copyright') ? '{"blocked":false,"note":null}' : CREATE_PAGE,
    source_fetch_text: () => QIDIAN_PAGE,
    source_fetch_image: () => ({ bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' }),
    ai_generate_json: () => AI_REPLY,
    ttc_create_story: () => ({ success: true, message: null, redirectUrl: '/upload-anh-bia/777' }),
    ttc_upload_cover: () => 'ok',
    ...overrides,
  };
  invokeMock.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
    const handler = handlers[cmd];
    if (!handler) throw new Error(`unexpected invoke ${cmd}`);
    return handler(args ?? {});
  });
}

const callsOf = (cmd: string) => invokeMock.mock.calls.filter((c) => c[0] === cmd);

function setAiKey(apiKey: string) {
  localStorage.setItem(
    'nk_global_settings',
    JSON.stringify({ ai: { provider: 'gemini', gemini: { apiKey } } }),
  );
}

function renderModal() {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  render(
    <SettingsProvider>
      <SettingsModalProvider>
        <CreateBookModal onClose={onClose} onSuccess={onSuccess} />
      </SettingsModalProvider>
    </SettingsProvider>,
  );
  return { onSuccess, onClose };
}

async function fillLinkAndRunAi(link: string) {
  const linkInput = await screen.findByLabelText('Link truyện gốc');
  fireEvent.change(linkInput, { target: { value: link } });
  fireEvent.click(screen.getByRole('button', { name: /AI điền/ }));
}

const field = (name: string) => document.querySelector(`#createBookForm [name="${name}"]`) as HTMLInputElement;

describe('CreateBookModal', () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:cover');
    URL.revokeObjectURL = vi.fn();
  });

  it('fills the whole form from a source link, then creates the story and uploads its cover', async () => {
    setAiKey('KEY');
    mockBackend();
    const { onSuccess } = renderModal();

    await fillLinkAndRunAi('https://m.qidian.com/book/1010868264');

    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));
    expect(field('chinese_title').value).toBe('诡秘之主');
    expect(field('chinese_link').value).toBe('https://www.qidian.com/book/1010868264/');
    expect(field('author').value).toBe('Ái Tiềm Thủy Đích Ô Tặc');
    expect(field('author_original').value).toBe('爱潜水的乌贼');
    expect(field('description').value).toBe('Trong làn sóng hơi nước và máy móc.\n\nTa tỉnh lại từ quỷ bí.');
    expect(screen.getByDisplayValue('Huyền huyễn')).toBeTruthy();

    // The source is read from the mobile site; the model gets the user's configured provider + key.
    expect(callsOf('source_fetch_text')[0][1]).toEqual({ url: 'https://m.qidian.com/book/1010868264/' });
    const aiRequest = (callsOf('ai_generate_json')[0][1] as { request: Record<string, string> }).request;
    expect(aiRequest).toMatchObject({ provider: 'gemini', apiKey: 'KEY', model: 'gemini-3.8-flash' });
    expect(aiRequest.user).toContain('诡秘之主');
    expect(aiRequest.user).toContain('Loại truyện đăng: Truyện Convert');

    await waitFor(() => expect(screen.getByAltText('Ảnh bìa')).toBeTruthy());
    fireEvent.submit(document.getElementById('createBookForm')!);

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({ bookId: 777, title: 'Quỷ Bí Chi Chủ', coverError: null }),
    );
    const fields = new Map((callsOf('ttc_create_story')[0][1] as { fields: [string, string][] }).fields);
    expect(fields.get('_csrf')).toBe('tok123');
    expect(fields.get('title')).toBe('Quỷ Bí Chi Chủ');
    expect(fields.get('type')).toBe('truyen-cv');
    expect(fields.get('chinese_link')).toBe('https://www.qidian.com/book/1010868264/');
    expect(fields.get('category')).toBe('Huyền huyễn');
    expect(callsOf('ttc_upload_cover')[0][1]).toEqual({ bookId: 777, imageBytes: [0xff, 0xd8, 0xff], mimeType: 'image/jpeg' });
  });

  it('without an AI key, still fills the source fields and points to the AI settings', async () => {
    mockBackend();
    renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');

    await waitFor(() => expect(field('chinese_title').value).toBe('诡秘之主'));
    expect(field('author_original').value).toBe('爱潜水的乌贼');
    expect(field('title').value).toBe('');
    expect(await screen.findByText(/Chưa cấu hình API key cho AI nên chưa dịch được/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mở cài đặt AI' })).toBeTruthy();
    expect(callsOf('ai_generate_json')).toHaveLength(0);
  });

  it('rejects a link from an unsupported site without calling anything', async () => {
    setAiKey('KEY');
    mockBackend();
    renderModal();

    await fillLinkAndRunAi('https://www.69shuba.com/book/1.htm');

    expect((await screen.findByRole('alert')).textContent).toMatch(/Link không được hỗ trợ.*Fanqie.*JJWXC và Ciweimao/);
    expect(callsOf('source_fetch_text')).toHaveLength(0);
  });

  it("shows TTC's own message when it refuses the story, where the submit button is", async () => {
    setAiKey('KEY');
    const message = "Lỗi: Tên tiếng Trung '卖个早点，怎么上班族全迟到了' đã có người đăng trong mục truyen-dich!";
    mockBackend({ ttc_create_story: () => ({ success: false, message, redirectUrl: null }) });
    const { onSuccess } = renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');
    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));
    fireEvent.submit(document.getElementById('createBookForm')!);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(message);

    // The form scrolls and the submit button sits in the fixed footer: an alert rendered
    // inside the scrolling body is off-screen for anyone who scrolled down to submit.
    const scrollBody = document.getElementById('createBookForm')!.parentElement!;
    expect(scrollBody.className).toContain('overflow-y-auto');
    expect(scrollBody.contains(alert)).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(callsOf('ttc_upload_cover')).toHaveLength(0);
  });

  it('keeps the modal open to report a failed cover upload after the story was created', async () => {
    setAiKey('KEY');
    mockBackend({
      ttc_upload_cover: () => {
        throw 'HTTP 413 Payload Too Large';
      },
    });
    const { onSuccess } = renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');
    await waitFor(() => expect(screen.getByAltText('Ảnh bìa')).toBeTruthy());
    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));
    fireEvent.submit(document.getElementById('createBookForm')!);

    expect(await screen.findByText(/Chưa tải được ảnh bìa: HTTP 413 Payload Too Large/)).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();

    // Footer button (the header ✕ carries the same accessible name).
    fireEvent.click(screen.getByText('Đóng'));
    expect(onSuccess).toHaveBeenCalledWith({ bookId: 777, title: 'Quỷ Bí Chi Chủ', coverError: 'HTTP 413 Payload Too Large' });
  });

  it('resolves a chapter-only link through its chapter page, then reads both book pages', async () => {
    setAiKey('KEY');
    const pages = {
      'https://m.sfacg.com/c/9360421/': '<a href="/b/759334/">返回</a>',
      'https://m.sfacg.com/b/759334/':
        '<ul class="book_info"><li><span class="book_newtitle">仙子</span><div class="book_info2"><span>古风</span></div>' +
        '<span class="book_info3">合雪丶 / 2044302字</span></li><li><img src="//rs.sfacg.com/c.jpg"></li></ul>' +
        '<ul class="book_profile"><li class="book_bk_qs1">简介第一段。</li></ul>',
      'https://book.sfacg.com/Novel/759334/': '<ul class="tag-list"><li class="tag"><span class="text">仙侠</span></li></ul>',
    };
    mockBackend({ source_fetch_text: (args) => pages[args.url as keyof typeof pages] });
    renderModal();

    await fillLinkAndRunAi('https://m.sfacg.com/c/9360421/');

    await waitFor(() => expect(field('chinese_title').value).toBe('仙子'));
    expect(field('chinese_link').value).toBe('https://book.sfacg.com/Novel/759334/');
    expect(field('author_original').value).toBe('合雪丶');
    expect(callsOf('source_fetch_text').map((c) => (c[1] as { url: string }).url)).toEqual(Object.keys(pages));
    await waitFor(() => expect(callsOf('ai_generate_json')).toHaveLength(1));
    const prompt = (callsOf('ai_generate_json')[0][1] as { request: { user: string } }).request.user;
    expect(prompt).toContain('Nguồn: SFACG');
    expect(prompt).toContain('Nhãn gốc: 仙侠');
    expect(callsOf('source_fetch_image')[0][1]).toEqual({ url: 'https://rs.sfacg.com/c.jpg' });
  });

  it('when the content filter rejects the synopsis, fills the rest from a second request without it', async () => {
    setAiKey('KEY');
    const refusal = "The prompt could not be submitted. The prompt contains sensitive words that violate Google's [Generative AI Prohibited Use policy](https://policies.google.com/terms/generative-ai/use-policy). If you believe this is an error, [send feedback](https://ai.google.dev/gemini-api/docs/troubleshooting).";
    let aiCalls = 0;
    mockBackend({
      // Google refuses the full prompt; without the synopsis the same book goes through.
      ai_generate_json: () => (++aiCalls === 1 ? refusal : AI_REPLY),
    });
    renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');

    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));
    expect(field('author').value).toBe('Ái Tiềm Thủy Đích Ô Tặc');
    expect(screen.getByDisplayValue('Huyền huyễn')).toBeTruthy();
    // The description is left for the user: whatever the model wrote without seeing the synopsis is not used.
    expect(field('description').value).toBe('');
    expect(await screen.findByText(/Bộ lọc nội dung của nhà cung cấp AI chặn văn án của truyện này/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    const prompts = callsOf('ai_generate_json').map((c) => (c[1] as { request: { user: string } }).request.user);
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toContain('我从诡秘中醒来。');
    expect(prompts[1]).not.toContain('我从诡秘中醒来。');
    expect(prompts[1]).toContain('Tên truyện (tiếng Trung): 诡秘之主');
  });

  it('says plainly that the provider refuses the book when even the short request is blocked', async () => {
    setAiKey('KEY');
    const refusal = "The prompt could not be submitted. The prompt contains sensitive words that violate Google's [Generative AI Prohibited Use policy](https://policies.google.com/terms/generative-ai/use-policy). If you believe this is an error, [send feedback](https://ai.google.dev/gemini-api/docs/troubleshooting).";
    mockBackend({ ai_generate_json: () => refusal });
    renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Nhà cung cấp AI từ chối truyện này vì bộ lọc nội dung/);
    expect(alert.textContent).toMatch(/Cài đặt → AI/);
    // Not presented as a formatting problem, and not retried beyond the one fallback.
    expect(alert.textContent).not.toMatch(/JSON/);
    expect(callsOf('ai_generate_json')).toHaveLength(2);
    // The fields read from the source are still there.
    expect(field('chinese_title').value).toBe('诡秘之主');
  });

  it('clears what came from the previous book when another link is filled and the AI call fails', async () => {
    setAiKey('KEY');
    let aiCalls = 0;
    mockBackend({
      // Book A is read from Qidian, book B from JJWXC.
      source_fetch_text: (args) =>
        String(args.url).includes('jjwxc')
          ? JSON.stringify({
              novelName: '和雇主儿子的秘密关系',
              authorName: '即枫',
              novelClass: '原创-言情-近代现代-爱情-女主',
              novelTags: '都市,甜文',
              novelCover: 'https://pic.rmb.bdstatic.com/bjh/portrait/b.jpeg',
              novelIntro: '赫赫有名的厉先生找上门。',
            })
          : QIDIAN_PAGE,
      // The first fill succeeds; for the second book the model answers with something unusable.
      ai_generate_json: () => (++aiCalls === 1 ? AI_REPLY : 'Xin lỗi, tôi không thể giúp.'),
      // Book B's cover cannot be downloaded either.
      source_fetch_image: (args) => {
        if (String(args.url).includes('bdstatic')) throw 'Không tải được ảnh bìa: máy chủ ảnh trả về HTTP 403 Forbidden';
        return { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' };
      },
    });
    renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');
    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));
    await waitFor(() => expect(screen.getByAltText('Ảnh bìa')).toBeTruthy());

    await fillLinkAndRunAi('https://www.jjwxc.net/onebook.php?novelid=9202298');
    expect((await screen.findByRole('alert')).textContent).toMatch(/không đúng định dạng JSON \(“Xin lỗi, tôi không thể giúp\.”\)/);

    // Book B's own fields are in...
    expect(field('chinese_title').value).toBe('和雇主儿子的秘密关系');
    expect(field('chinese_link').value).toBe('https://www.jjwxc.net/onebook.php?novelid=9202298');
    expect(field('author_original').value).toBe('即枫');
    // ...and nothing of book A is left to be posted under book B's name.
    expect(field('title').value).toBe('');
    expect(field('author').value).toBe('');
    expect(field('description').value).toBe('');
    const selects = Array.from(document.querySelectorAll('#createBookForm select')) as HTMLSelectElement[];
    expect(selects.map((s) => s.value)).toEqual(['', '', '', '']);
    expect(screen.queryByAltText('Ảnh bìa')).toBeNull();
  });

  it('keeps the filled form when the same book is filled again and the AI call fails', async () => {
    setAiKey('KEY');
    let aiCalls = 0;
    mockBackend({ ai_generate_json: () => (++aiCalls === 1 ? AI_REPLY : 'Xin lỗi, tôi không thể giúp.') });
    renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');
    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));
    await waitFor(() => expect(screen.getByAltText('Ảnh bìa')).toBeTruthy());

    // Same book through another link form: a retry, not a switch.
    await fillLinkAndRunAi('https://m.qidian.com/book/1010868264');
    await screen.findByRole('alert');

    expect(field('title').value).toBe('Quỷ Bí Chi Chủ');
    expect(field('description').value).toBe('Trong làn sóng hơi nước và máy móc.\n\nTa tỉnh lại từ quỷ bí.');
    expect(screen.getByAltText('Ảnh bìa')).toBeTruthy();
  });

  it('points out a title that still says "Tôi" despite the house style', async () => {
    setAiKey('KEY');
    const reply = JSON.stringify({ ...JSON.parse(AI_REPLY), title: 'tôi có thể sao chép thiên phú' });
    mockBackend({ ai_generate_json: () => reply });
    renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');

    await waitFor(() => expect(field('title').value).toBe('Tôi Có Thể Sao Chép Thiên Phú'));
    expect(await screen.findByText(/Tên truyện còn chữ “Tôi”: quy ước là dùng “Ta”/)).toBeTruthy();
  });

  it('requires all four tags and names the ones the model failed to pick', async () => {
    setAiKey('KEY');
    // The model leaves tinh_cach empty and invents a luu_phai that is not in the form.
    const reply = JSON.stringify({ ...JSON.parse(AI_REPLY), tinh_cach: '', luu_phai: 'Vô Địch Lưu' });
    mockBackend({ ai_generate_json: () => reply });
    renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');
    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));

    expect(
      await screen.findByText(/AI chưa chọn được: Tính cách, Lưu phái. Các mục này bắt buộc, hãy chọn tay./),
    ).toBeTruthy();

    // Thể loại + Tính cách + Bối cảnh + Lưu phái: the form itself refuses to submit without them.
    const selects = Array.from(document.querySelectorAll('#createBookForm select')) as HTMLSelectElement[];
    expect(selects).toHaveLength(4);
    expect(selects.every((s) => s.required)).toBe(true);
    expect(selects.map((s) => s.value)).toEqual(['Huyền huyễn', '', 'Tây Phương Kỳ Huyền', '']);
  });

  it('sends the chosen story type to the model, so a translation gets a plain-Vietnamese title', async () => {
    setAiKey('KEY');
    mockBackend();
    renderModal();

    await screen.findByLabelText('Link truyện gốc');
    fireEvent.click(screen.getByRole('button', { name: 'Truyện Dịch' }));
    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');
    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));

    const aiRequest = (callsOf('ai_generate_json')[0][1] as { request: Record<string, string> }).request;
    expect(aiRequest.user).toContain('Loại truyện đăng: Truyện Dịch');
  });

  it('retries the cover upload for the story that already exists, without creating it again', async () => {
    setAiKey('KEY');
    let uploads = 0;
    mockBackend({
      // TTC drops the first upload with a gateway timeout, then accepts the retry.
      ttc_upload_cover: () => {
        uploads++;
        if (uploads === 1) throw 'HTTP 504 Gateway Timeout';
        return 'ok';
      },
    });
    const { onSuccess } = renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');
    await waitFor(() => expect(screen.getByAltText('Ảnh bìa')).toBeTruthy());
    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));
    fireEvent.submit(document.getElementById('createBookForm')!);

    expect(await screen.findByText(/Chưa tải được ảnh bìa: HTTP 504 Gateway Timeout/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Thử lại tải ảnh bìa/ }));

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({ bookId: 777, title: 'Quỷ Bí Chi Chủ', coverError: null }),
    );
    // Same image, same story: the retry must not post the create form a second time.
    const coverCalls = callsOf('ttc_upload_cover');
    expect(coverCalls).toHaveLength(2);
    expect(coverCalls[1][1]).toEqual(coverCalls[0][1]);
    expect(callsOf('ttc_create_story')).toHaveLength(1);
  });

  it('keeps the retry available when the cover upload fails again', async () => {
    setAiKey('KEY');
    mockBackend({
      ttc_upload_cover: () => {
        throw 'HTTP 504 Gateway Timeout';
      },
    });
    const { onSuccess } = renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');
    await waitFor(() => expect(screen.getByAltText('Ảnh bìa')).toBeTruthy());
    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));
    fireEvent.submit(document.getElementById('createBookForm')!);

    fireEvent.click(await screen.findByRole('button', { name: /Thử lại tải ảnh bìa/ }));

    await waitFor(() => expect(callsOf('ttc_upload_cover')).toHaveLength(2));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: /Thử lại tải ảnh bìa/ }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('falls back through the cover candidates and lets the user retry a failed cover download', async () => {
    setAiKey('KEY');
    const SHRINK = 'https://p6-novel.byteimg.com/novel-pic/abc~tplv-shrink:640:0.image';
    const ORIGIN = 'https://p6-novel.byteimg.com/origin/novel-pic/abc';
    let attempt = 0;
    mockBackend({
      source_fetch_text: () => FANQIE_PAGE,
      // Attempts 1-3 fail (both candidates, then the first again); the 4th succeeds.
      source_fetch_image: () => {
        attempt++;
        if (attempt <= 3) throw 'Không tải được ảnh bìa sau 2 lần thử: hết thời gian chờ';
        return { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' };
      },
    });
    renderModal();

    await fillLinkAndRunAi('https://fanqienovel.com/page/7069948840148732967');

    // Both candidates failed: the cover section says why, the rest of the form is filled anyway.
    expect(await screen.findByText('Không tải được ảnh bìa sau 2 lần thử: hết thời gian chờ')).toBeTruthy();
    expect(callsOf('source_fetch_image').map((c) => (c[1] as { url: string }).url)).toEqual([SHRINK, ORIGIN]);
    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));
    expect(screen.queryByAltText('Ảnh bìa')).toBeNull();

    // Retry: the first candidate fails once more, the fallback delivers the cover.
    fireEvent.click(screen.getByRole('button', { name: /Tải lại ảnh bìa từ nguồn/ }));

    await waitFor(() => expect(screen.getByAltText('Ảnh bìa')).toBeTruthy());
    expect(callsOf('source_fetch_image').map((c) => (c[1] as { url: string }).url)).toEqual([SHRINK, ORIGIN, SHRINK, ORIGIN]);
    expect(screen.queryByText(/hết thời gian chờ/)).toBeNull();
    // With the cover in hand the button goes back to its plain label.
    expect(screen.queryByRole('button', { name: /Tải lại ảnh bìa từ nguồn/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Tải ảnh bìa từ nguồn/ })).toBeTruthy();
  });

  it('downloads the cover from the source without running the AI', async () => {
    mockBackend();
    renderModal();

    const linkInput = await screen.findByLabelText('Link truyện gốc');
    // No source link yet: nothing to download from.
    expect(screen.queryByRole('button', { name: /Tải ảnh bìa từ nguồn/ })).toBeNull();

    fireEvent.change(linkInput, { target: { value: 'https://www.qidian.com/book/1010868264/' } });
    fireEvent.click(screen.getByRole('button', { name: /Tải ảnh bìa từ nguồn/ }));

    await waitFor(() => expect(screen.getByAltText('Ảnh bìa')).toBeTruthy());
    expect(await screen.findByText(/Đã tải ảnh bìa từ trang gốc/)).toBeTruthy();
    // Reading the source also fills the Chinese fields, but no model was asked.
    expect(field('chinese_title').value).toBe('诡秘之主');
    expect(field('author_original').value).toBe('爱潜水的乌贼');
    expect(field('title').value).toBe('');
    expect(callsOf('ai_generate_json')).toHaveLength(0);
    expect(callsOf('source_fetch_image')[0][1]).toEqual({ url: 'https://bookcover.yuewen.com/qdbimg/349573/1010868264/600' });
  });

  it('lets the user stop waiting for a slow cover download, then submit or retry', async () => {
    setAiKey('KEY');
    let deliver: (image: { bytes: number[]; mime: string }) => void = () => {};
    mockBackend({
      // A cover host that has not answered yet.
      source_fetch_image: () => new Promise((resolve) => (deliver = resolve)),
    });
    renderModal();

    await fillLinkAndRunAi('https://www.qidian.com/book/1010868264/');
    await waitFor(() => expect(field('title').value).toBe('Quỷ Bí Chi Chủ'));

    // While the cover is downloading, submitting would create the story without it.
    const submit = screen.getByRole('button', { name: 'Đăng Truyện' }) as HTMLButtonElement;
    expect(screen.getByText('Đang tải ảnh bìa từ trang gốc...')).toBeTruthy();
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua' }));

    expect(screen.queryByText('Đang tải ảnh bìa từ trang gốc...')).toBeNull();
    expect(submit.disabled).toBe(false);
    expect(screen.getByRole('button', { name: /Tải lại ảnh bìa từ nguồn/ })).toBeTruthy();

    // The abandoned download answering late must not bring the cover back.
    deliver({ bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByAltText('Ảnh bìa')).toBeNull();
  });

  it('an original story hides the Chinese-source fields and is authored by the account', async () => {
    mockBackend();
    renderModal();

    await screen.findByLabelText('Link truyện gốc');
    // Story type is a one-click segmented control, not a dropdown.
    const typeGroup = screen.getByRole('group', { name: 'Loại truyện' });
    expect(typeGroup.querySelector('[aria-pressed="true"]')!.textContent).toBe('Truyện Convert');
    fireEvent.click(screen.getByRole('button', { name: 'Truyện Sáng Tác' }));
    expect(typeGroup.querySelector('[aria-pressed="true"]')!.textContent).toBe('Truyện Sáng Tác');

    expect(field('author').value).toBe('Thương Hải Hoành Lưu');
    expect(field('author').readOnly).toBe(true);
    expect(field('chinese_title')).toBeNull();
    expect(field('author_original')).toBeNull();
    expect(screen.queryByLabelText('Link truyện gốc')).toBeNull();
  });
});
