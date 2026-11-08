import { describe, expect, it } from 'vitest';
import type { ParsedChapter, TtcStory } from '../types';
import { buildMeoImport, orderPicks } from './buildImport';
import type { MeoGenre } from './types';

const GENRES: MeoGenre[] = [
  { slug: 'co-dai', name: 'Cổ đại', kind: 'genre', sort: 1 },
  { slug: 'hien-dai', name: 'Hiện đại', kind: 'genre', sort: 2 },
  { slug: 'ngot-ngao', name: 'Ngọt ngào', kind: 'tag', sort: 2 },
  { slug: 'trong-sinh', name: 'Trọng sinh', kind: 'tag', sort: 1 },
];

const story = (extra: Partial<TtcStory> = {}): TtcStory => ({
  id: 31001,
  title: 'Thứ Nữ Trọng Sinh',
  author: 'Mộc Lan',
  poster: '/stories/31001/poster.jpg',
  category: 'Cổ đại',
  status: 'full',
  total_chapters: 2,
  latest_chapter_title: 'Chương 2: Hai',
  last_chap_updated: null,
  views: 0,
  follows: 0,
  gender: 'Nữ',
  chinese_title: '庶女重生',
  chinese_link: 'https://www.jjwxc.net/onebook.php?novelid=1',
  author_original: '木兰',
  description: 'Văn án.\n\nĐoạn hai.',
  ...extra,
});

const chapter = (index: number, title = `Chương ${index}: Tên ${index}`, content = `Chương ${index}: Tên ${index}\nNội dung chương ${index}.`): ParsedChapter => ({
  index,
  title,
  content,
  word_count: 3,
  file_name: `${index}.txt`,
});

const picks = { genres: ['ngot-ngao', 'co-dai', 'khong-co'], editorNote: '  Truyện ngọt.  ' };

describe('buildMeoImport', () => {
  it('maps a female TTC story and its folder to the import body', () => {
    const build = buildMeoImport(story(), [chapter(2), chapter(1)], picks, GENRES);
    expect(build.problems).toEqual([]);
    expect(build.open).toEqual({
      title: 'Thứ Nữ Trọng Sinh',
      titleZh: '庶女重生',
      author: 'Mộc Lan',
      authorZh: '木兰',
      translator: null,
      sourceUrl: 'https://www.jjwxc.net/onebook.php?novelid=1',
      synopsis: 'Văn án.\n\nĐoạn hai.',
      status: 'completed',
      appId: 31001,
      editorNote: 'Truyện ngọt.',
      genres: ['co-dai', 'ngot-ngao'],
      chapters: [
        { number: 1, title: 'Chương 1: Tên 1' },
        { number: 2, title: 'Chương 2: Tên 2' },
      ],
    });
    // The heading line is taken out of the text, as the site's importer does.
    expect(build.texts.map((t) => t.text)).toEqual(['Nội dung chương 1.', 'Nội dung chương 2.']);
    expect(build.wordCount).toBe(8);
  });

  it('refuses a male story, and one without a Chinese title, synopsis or genre', () => {
    const build = buildMeoImport(story({ gender: 'Nam', chinese_title: '', description: '  ' }), [chapter(1)], { genres: ['ngot-ngao'], editorNote: '' }, GENRES);
    expect(build.problems).toEqual([
      'Chỉ truyện nữ mới đăng được lên Mèo Truyện.',
      'Truyện chưa có tên tiếng Trung (Mèo Truyện dùng nó để kiểm trùng): điền ở "Sửa" trên TTC.',
      'Truyện chưa có giới thiệu (văn án).',
      'Chọn ít nhất một thể loại.',
    ]);
  });

  it('needs every chapter from 1 on, without a gap', () => {
    expect(buildMeoImport(story(), [], picks, GENRES).problems).toEqual(['Folder chưa có chương nào.']);
    expect(buildMeoImport(story(), [chapter(4), chapter(5)], picks, GENRES).problems[0]).toMatch(/bắt đầu từ chương 4 \(đang bỏ qua 3/);
    expect(buildMeoImport(story(), [chapter(1), chapter(3)], picks, GENRES).problems).toEqual([
      'Số chương phải liên tục từ 1; thiếu hoặc lệch ở chương 2.',
    ]);
  });

  it('reports empty and oversized chapters, and names a chapter from its heading', () => {
    const big = 'a'.repeat(205 * 1024);
    const build = buildMeoImport(story(), [chapter(1, '', 'Chương 1: Mở đầu\nChữ.'), chapter(2, 'Chương 2', '   '), chapter(3, 'Chương 3', big)], picks, GENRES);
    expect(build.open.chapters[0]).toEqual({ number: 1, title: 'Chương 1: Mở đầu' });
    expect(build.problems).toEqual(['Nội dung chương 2 đang trống.', 'Nội dung chương 3 vượt 200 KB.']);
  });

  it('maps the status and drops a source link that is not a web link', () => {
    const paused = buildMeoImport(story({ status: 'paused', chinese_link: 'fanqie 123' }), [chapter(1)], picks, GENRES);
    expect(paused.open.status).toBe('paused');
    expect(paused.open.sourceUrl).toBeNull();
    expect(paused.warnings).toEqual(['Link nguồn không phải link http(s) hợp lệ nên không gửi kèm.']);
    expect(buildMeoImport(story({ status: 'ongoing' }), [chapter(1)], picks, GENRES).open.status).toBe('ongoing');
  });
});

describe('orderPicks', () => {
  it('keeps slugs of the site, genres first, each once', () => {
    expect(orderPicks(['ngot-ngao', 'x', 'trong-sinh', 'hien-dai', 'ngot-ngao'], GENRES)).toEqual(['hien-dai', 'trong-sinh', 'ngot-ngao']);
  });
});
