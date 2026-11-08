import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/features/settings/context/SettingsContext';
import type { TtcStory } from '../types';
import { useMeoTruyenUpload } from './useMeoTruyenUpload';
import type { MeoGenre, MeoLink } from './types';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
// jsdom has no Web Worker: parse on the test thread instead.
vi.mock('../utils/chapterParser', async () => {
  const { parseLocalChapters } = await import('../utils/localChapters');
  return {
    createChapterParser: () => ({
      firstChapter: async () => null,
      allChapters: async (...args: Parameters<typeof parseLocalChapters>) => parseLocalChapters(...args),
      dispose: () => {},
    }),
  };
});
// jsdom has no canvas.
vi.mock('./cover', () => ({ buildMeoCover: async () => ({ full: 'FULL', thumb: 'THUMB', previewUrl: 'data:image/jpeg;base64,FULL' }) }));

const GENRES: MeoGenre[] = [
  { slug: 'co-dai', name: 'Cổ đại', kind: 'genre', sort: 1 },
  { slug: 'ngot-ngao', name: 'Ngọt ngào', kind: 'tag', sort: 2 },
  { slug: 'song-lai-trung-sinh', name: 'Sống lại (Trùng sinh)', kind: 'tag', sort: 19 },
];

const STORY: TtcStory = {
  id: 31001,
  title: 'Thứ Nữ Trọng Sinh',
  author: 'Mộc Lan',
  poster: '/stories/31001/poster.jpg',
  category: 'Cổ đại',
  status: 'ongoing',
  total_chapters: 2,
  latest_chapter_title: 'Chương 2: Hai',
  last_chap_updated: null,
  views: 0,
  follows: 0,
  gender: 'Nữ',
  chinese_title: '庶女重生',
  chinese_link: 'https://www.jjwxc.net/onebook.php?novelid=1',
  author_original: '木兰',
  description: 'Nàng sống lại.',
};

const FILES = [
  { name: '1.txt', text: 'Chương 1: Một\n\nNội dung một.' },
  { name: '2.txt', text: 'Chương 2: Hai\n\nNội dung hai.' },
];

const duplicate = (id: number, chaptersDeleted = 0) => ({
  status: 409,
  code: 'duplicate_book',
  message: 'Đã có truyện trùng tên tiếng Trung hay link nguồn.',
  details: {
    matches: [{ id, slug: 'thu-nu', title: 'Thứ Nữ', isPublished: true, chapterCount: 2, fields: ['titleZh'], chaptersDeleted, commentsDeleted: 0 }],
  },
});

let openReplies: unknown[] = [];
const calls = (cmd: string) => invokeMock.mock.calls.filter((c) => c[0] === cmd).map((c) => c[1]);

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

describe('useMeoTruyenUpload', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'nk_global_settings',
      JSON.stringify({ ai: { provider: 'gemini', gemini: { apiKey: 'k', model: 'm', baseUrl: '' } }, meoTruyen: { token: 'mtk_test' } }),
    );
    localStorage.setItem('nk_book_settings', JSON.stringify({ 31001: { ttcUploader: { folderPath: '/books/1', enableSplit: false } } }));
    openReplies = [];
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'meotruyen_token_source':
          return 'settings';
        case 'meotruyen_genres':
          return GENRES;
        case 'ai_generate_json':
          return JSON.stringify({ genres: ['co-dai'], tags: ['song-lai-trung-sinh'], editorNote: 'Truyện trùng sinh nhẹ nhàng.' });
        case 'ttc_read_folder_files':
          return FILES;
        case 'meotruyen_import_open': {
          const reply = openReplies.shift() ?? { jobId: 'job-1', slug: 'thu-nu' };
          if ('code' in (reply as object)) throw reply;
          return reply;
        }
        case 'meotruyen_import_send':
          return { received: 2 };
        case 'meotruyen_import_finalize':
          return { id: 77, slug: 'thu-nu' };
        default:
          throw new Error(`unexpected invoke ${cmd}`);
      }
    });
  });

  it('lets the model pick, then opens, sends and finalizes a new import', async () => {
    const onImported = vi.fn();
    const { result } = renderHook(() => useMeoTruyenUpload(STORY, undefined, onImported), { wrapper });
    await waitFor(() => expect(result.current.canSend).toBe(true));
    expect(result.current.picks).toEqual({ genres: ['co-dai', 'song-lai-trung-sinh'], editorNote: 'Truyện trùng sinh nhẹ nhàng.' });

    await act(() => result.current.send());

    expect(calls('meotruyen_import_open')).toEqual([
      {
        token: 'mtk_test',
        input: expect.objectContaining({
          titleZh: '庶女重生',
          appId: 31001,
          genres: ['co-dai', 'song-lai-trung-sinh'],
          editorNote: 'Truyện trùng sinh nhẹ nhàng.',
          chapters: [
            { number: 1, title: 'Chương 1: Một' },
            { number: 2, title: 'Chương 2: Hai' },
          ],
          cover: { full: 'FULL', thumb: 'THUMB' },
        }),
      },
    ]);
    expect(calls('meotruyen_import_open')[0].input).not.toHaveProperty('overwriteBookId');
    expect(calls('meotruyen_import_send')).toEqual([
      {
        token: 'mtk_test',
        jobId: 'job-1',
        chapters: [
          { number: 1, text: 'Nội dung một.' },
          { number: 2, text: 'Nội dung hai.' },
        ],
      },
    ]);
    expect(calls('meotruyen_import_finalize')).toEqual([{ token: 'mtk_test', jobId: 'job-1' }]);
    expect(onImported).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: 77, slug: 'thu-nu', genres: ['co-dai', 'song-lai-trung-sinh'], chapters: 2 }),
    );
    expect(result.current.phase).toBe('done');
    expect(result.current.result).toEqual({ book: { id: 77, slug: 'thu-nu' }, overwrote: false });
  });

  it('updates the book a story was imported as, with its picks and without asking', async () => {
    const link: MeoLink = { bookId: 77, slug: 'thu-nu', genres: ['co-dai', 'ngot-ngao'], editorNote: 'Cũ.', chapters: 1, at: 0 };
    openReplies = [duplicate(77)];
    const { result } = renderHook(() => useMeoTruyenUpload(STORY, link, vi.fn()), { wrapper });
    await waitFor(() => expect(result.current.canSend).toBe(true));
    expect(result.current.picks).toEqual({ genres: ['co-dai', 'ngot-ngao'], editorNote: 'Cũ.' });

    await act(() => result.current.send());

    expect(calls('ai_generate_json')).toHaveLength(0);
    const opens = calls('meotruyen_import_open');
    expect(opens).toHaveLength(2);
    expect(opens[1].input.overwriteBookId).toBe(77);
    expect(result.current.result).toEqual({ book: { id: 77, slug: 'thu-nu' }, overwrote: true });
  });

  it('puts any other duplicate to the user, and overwrites the one picked', async () => {
    openReplies = [duplicate(90, 3)];
    const { result } = renderHook(() => useMeoTruyenUpload(STORY, undefined, vi.fn()), { wrapper });
    await waitFor(() => expect(result.current.canSend).toBe(true));

    await act(() => result.current.send());
    expect(result.current.phase).toBe('duplicate');
    expect(result.current.duplicates.map((d) => d.id)).toEqual([90]);
    expect(calls('meotruyen_import_send')).toHaveLength(0);

    await act(() => result.current.send(90));
    expect(calls('meotruyen_import_open')[1].input.overwriteBookId).toBe(90);
    expect(result.current.phase).toBe('done');
  });

  it('shows every problem the site lists when it refuses the import', async () => {
    openReplies = [
      { status: 400, code: 'bad_import', message: 'a', details: { problems: [{ field: 'title', message: 'Tên lỗi.' }, { field: 'genres', message: 'Thể loại lỗi.' }] } },
    ];
    const { result } = renderHook(() => useMeoTruyenUpload(STORY, undefined, vi.fn()), { wrapper });
    await waitFor(() => expect(result.current.canSend).toBe(true));

    await act(() => result.current.send());
    expect(result.current.phase).toBe('ready');
    expect(result.current.sendError).toBe('Mèo Truyện từ chối dữ liệu nạp: Tên lỗi. · Thể loại lỗi.');
  });

  it('cannot send a story without a folder', async () => {
    localStorage.setItem('nk_book_settings', '{}');
    const { result } = renderHook(() => useMeoTruyenUpload(STORY, undefined, vi.fn()), { wrapper });
    await waitFor(() => expect(result.current.genres.state).toBe('ok'));
    expect(result.current.chapters).toEqual({ state: 'error', message: expect.stringMatching(/chưa chọn folder/) });
    expect(result.current.canSend).toBe(false);
  });
});
