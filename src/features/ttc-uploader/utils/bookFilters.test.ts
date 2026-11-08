import { describe, it, expect } from 'vitest';
import { filterBySources, inTab, NO_SOURCE, sourceCounts, type TabContext } from './bookFilters';
import type { TtcStory } from '../types';

const story = (id: number, extra: Partial<TtcStory> = {}): TtcStory => ({
  id,
  title: `Truyện ${id}`,
  author: '',
  poster: '',
  category: '',
  status: 'ongoing',
  total_chapters: 10,
  latest_chapter_title: null,
  last_chap_updated: null,
  views: 0,
  follows: 0,
  ...extra,
});

const FANQIE = 'https://fanqienovel.com/page/7582401378450951193';
const QIDIAN = 'https://www.qidian.com/book/1047881520/';
const BOOKS = [
  story(1, { chinese_link: FANQIE }),
  story(2, { chinese_link: QIDIAN, approved: false }),
  story(3, { chinese_link: FANQIE, total_chapters: 0 }),
  story(4, { chinese_link: '' }),
];

describe('sourceCounts / filterBySources', () => {
  it('counts the sources, most used first and stories without a source last', () => {
    expect(sourceCounts(BOOKS)).toEqual([
      { name: 'Fanqie', count: 2 },
      { name: 'Qidian', count: 1 },
      { name: NO_SOURCE, count: 1 },
    ]);
  });

  it('keeps every story when no source is picked, and any of the picked ones otherwise', () => {
    expect(filterBySources(BOOKS, [])).toHaveLength(4);
    expect(filterBySources(BOOKS, ['Qidian', NO_SOURCE]).map((b) => b.id)).toEqual([2, 4]);
  });
});

describe('inTab', () => {
  const ctx: TabContext = {
    hasFolder: (id) => id !== 4,
    folderStatus: (id) =>
      id === 1 ? { kind: 'ahead', localCount: 12, remoteCount: 10 } : id === 2 ? { kind: 'synced', localCount: 10 } : undefined,
  };
  const ids = (tab: Parameters<typeof inTab>[1]) => BOOKS.filter((b) => inTab(b, tab, ctx)).map((b) => b.id);

  it('filters each tab locally', () => {
    expect(ids('all')).toEqual([1, 2, 3, 4]);
    expect(ids('pending')).toEqual([2]);
    expect(ids('empty')).toEqual([3]);
    expect(ids('noFolder')).toEqual([4]);
    // Story 3 has a folder that is not read yet: it shows once it is known to differ.
    expect(ids('unsynced')).toEqual([1]);
  });
});
