import { describe, expect, it } from 'vitest';
import type { TtcStory } from '../types';
import { buildPickPrompt, cleanEditorNote, parsePickReply } from './ai';
import type { MeoGenre } from './types';
import type { SourceBook } from '../sources';

const GENRES: MeoGenre[] = [
  { slug: 'co-dai', name: 'Cổ đại', kind: 'genre', sort: 1 },
  { slug: 'hien-dai', name: 'Hiện đại', kind: 'genre', sort: 2 },
  { slug: 'tien-hiep', name: 'Tiên hiệp', kind: 'genre', sort: 4 },
  { slug: 'ngot-ngao', name: 'Ngọt ngào', kind: 'tag', sort: 2 },
  { slug: 'song-lai-trung-sinh', name: 'Sống lại (Trùng sinh)', kind: 'tag', sort: 19 },
];

const story: TtcStory = {
  id: 1,
  title: 'Thứ Nữ Trọng Sinh',
  author: 'Mộc Lan',
  poster: '',
  category: 'Cổ đại',
  status: 'ongoing',
  total_chapters: 1,
  latest_chapter_title: null,
  last_chap_updated: null,
  views: 0,
  follows: 0,
  chinese_title: '庶女重生',
  description: 'Nàng sống lại.',
  sub_categories: ['Nữ Cường', null, 'Trùng Sinh'],
};

describe('buildPickPrompt', () => {
  it('gives the story and both lists, and can leave the synopsis out', () => {
    const { system, user } = buildPickPrompt(story, GENRES);
    expect(system).toMatch(/editorNote/);
    expect(user).toContain('Phân loại trên app: Nữ Cường, Trùng Sinh');
    expect(user).toContain('Văn án:\nNàng sống lại.');
    // Each with its Chinese name, which the source labels match.
    expect(user).toContain('# Thể loại (slug: tên (tên tiếng Trung))\nco-dai: Cổ đại (古言)\nhien-dai: Hiện đại (现言)\ntien-hiep: Tiên hiệp (仙侠)');
    expect(user).toContain('# Chủ đề (slug: tên (tên tiếng Trung))\nngot-ngao: Ngọt ngào (甜文)\nsong-lai-trung-sinh: Sống lại (Trùng sinh) (重生)');
    expect(user).not.toContain('Nhãn gốc');
    expect(buildPickPrompt(story, GENRES, null, true).user).not.toContain('Nàng sống lại.');
  });

  it('gives the labels of the source book', () => {
    const source: SourceBook = {
      source: 'jjwxc',
      bookId: '1',
      link: 'https://www.jjwxc.net/onebook.php?novelid=1',
      title: '庶女重生',
      author: '木兰',
      intro: '',
      coverUrls: [],
      category: '原创-言情-古色古香-爱情-女主',
      tags: ['甜文', '重生', '宅斗'],
    };
    const { user } = buildPickPrompt(story, GENRES, source);
    expect(user).toContain('Trang nguồn: JJWXC (晋江文学城)');
    expect(user).toContain('Nhãn gốc tiếng Trung: 原创, 言情, 古色古香, 爱情, 女主, 甜文, 重生, 宅斗');
  });
});

describe('parsePickReply', () => {
  it('keeps slugs (or names) of the right kind only, each once', () => {
    const reply = '```json\n{"genres":["co-dai","ngot-ngao","Hiện đại","tien-hiep"],"tags":["Ngọt ngào","khong-co","co-dai","ngot-ngao","song-lai-trung-sinh"],"editorNote":"“Một truyện ngọt.”"}\n```';
    expect(parsePickReply(reply, GENRES)).toEqual({
      genres: ['co-dai', 'hien-dai'],
      tags: ['ngot-ngao', 'song-lai-trung-sinh'],
      editorNote: 'Một truyện ngọt.',
    });
  });

  it('survives missing keys', () => {
    expect(parsePickReply('{"genres":"co-dai"}', GENRES)).toEqual({ genres: [], tags: [], editorNote: '' });
  });
});

describe('cleanEditorNote', () => {
  it('makes one paragraph within 300 characters, cut at a sentence when it can', () => {
    expect(cleanEditorNote('  Dòng một.\n\nDòng hai.  ')).toBe('Dòng một. Dòng hai.');
    const long = `${'Câu đầu khá dài để thử. '.repeat(8)}${'chữ '.repeat(60)}`;
    const cut = cleanEditorNote(long);
    expect([...cut].length).toBeLessThanOrEqual(300);
    expect(cut.endsWith('thử.')).toBe(true);
    const words = cleanEditorNote('chữ '.repeat(100));
    expect([...words].length).toBeLessThanOrEqual(300);
    expect(words.endsWith('chữ…')).toBe(true);
    expect(cleanEditorNote(42)).toBe('');
  });
});
