import { describe, expect, it } from 'vitest';
import type { SourceBook } from '../sources';
import { matchSourceTags, sourceTerms } from './sourceTags';
import type { MeoGenre } from './types';
import { MEO_ZH_NAMES } from './zhNames';

const book = (category: string, tags: string[]): SourceBook => ({
  source: 'jjwxc',
  bookId: '1',
  link: 'https://www.jjwxc.net/onebook.php?novelid=1',
  title: 't',
  author: 'a',
  intro: '',
  coverUrls: [],
  category,
  tags,
});

const KNOWN: MeoGenre[] = [
  { slug: 'co-dai', name: 'Cổ đại', kind: 'genre', sort: 1 },
  { slug: 'light-novel', name: 'Light novel', kind: 'genre', sort: 9 },
  { slug: 'ngot-ngao', name: 'Ngọt ngào', kind: 'tag', sort: 2 },
  { slug: 'song-lai-trung-sinh', name: 'Sống lại (Trùng sinh)', kind: 'tag', sort: 19 },
  { slug: 'he', name: 'HE', kind: 'tag', sort: 37 },
  { slug: 'khoai-xuyen', name: 'Khoái xuyên', kind: 'tag', sort: 30 },
];

describe('sourceTerms', () => {
  it('splits a compound category and drops repeats', () => {
    expect(sourceTerms(book('原创-言情-古色古香-爱情-女主', ['甜文', ' 重生 ', '言情', '']))).toEqual([
      '原创',
      '言情',
      '古色古香',
      '爱情',
      '女主',
      '甜文',
      '重生',
    ]);
  });
});

describe('matchSourceTags', () => {
  it('picks the genres and tags whose Chinese name is a source label, whatever the case or brackets', () => {
    expect(matchSourceTags(book('轻小说', ['【甜文】', '重生', 'he', '穿越']), KNOWN)).toEqual([
      'light-novel',
      'ngot-ngao',
      'song-lai-trung-sinh',
      'he',
    ]);
    expect(matchSourceTags(null, KNOWN)).toEqual([]);
  });

  it('only knows slugs that have a Chinese name', () => {
    expect(MEO_ZH_NAMES['ngot-ngao']).toBe('甜文');
    expect(Object.keys(MEO_ZH_NAMES)).toHaveLength(288);
  });
});
