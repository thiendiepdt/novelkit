import { describe, it, expect } from 'vitest';
import { compareChapters, planSync } from './syncCompare';
import type { ParsedChapter, TtcChapter } from '../types';

const local = (index: number, title = `Chương ${index}`, words = 1000): ParsedChapter => ({
  index,
  title,
  content: `nội dung ${index}`,
  word_count: words,
  file_name: 'local_folder',
});

const remote = (chapterNumber: number, title = `Chương ${chapterNumber}`, wordCount = 1000): TtcChapter => ({
  chapterNumber,
  title,
  wordCount,
  views: 0,
  status: null,
  chapter_price: 0,
  last_chap_updated: null,
});

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('compareChapters', () => {
  it('counts the chapters TTC does not have yet', () => {
    const a = compareChapters(range(1, 5).map(i => local(i)), range(1, 3).map(i => remote(i)));
    expect(a.rows.map(r => r.status)).toEqual(['match', 'match', 'match', 'new', 'new']);
    expect(a.newCount).toBe(2);
    expect(a.changedCount).toBe(0);
    expect(a.firstChangedIndex).toBeNull();
    expect(a.maxLocalIndex).toBe(5);
  });

  it('flags a different title, and a length difference above 3%, from the first one', () => {
    const a = compareChapters(
      [local(1), local(2, 'Chương 2: Khác'), local(3, 'Chương 3', 1040), local(4, 'Chương 4', 1020)],
      [remote(1), remote(2), remote(3), remote(4)],
    );
    expect(a.rows.map(r => r.status)).toEqual(['match', 'changed', 'changed', 'match']);
    expect(a.firstChangedIndex).toBe(2);
    expect(a.changedCount).toBe(2);
  });

  it('ignores surrounding spaces in titles', () => {
    expect(compareChapters([local(1, '  Chương 1 ')], [remote(1, 'Chương 1')]).changedCount).toBe(0);
  });

  it('reports TTC chapters beyond the end of the folder', () => {
    expect(compareChapters(range(1, 2).map(i => local(i)), range(1, 5).map(i => remote(i))).remoteExtra).toBe(3);
  });

  it('respects the skipChapters offset of the folder', () => {
    // The folder starts at chapter 3: it is compared with TTC chapter 3, not chapter 1.
    const a = compareChapters([local(3), local(4)], range(1, 3).map(i => remote(i)));
    expect(a.rows.map(r => r.status)).toEqual(['match', 'new']);
    expect(a.maxLocalIndex).toBe(4);
  });
});

describe('planSync', () => {
  it('appends the chapters after the last one on TTC', () => {
    const plan = planSync(range(1, 5).map(i => local(i)), range(1, 3).map(i => remote(i)));
    expect(plan.kind).toBe('new');
    expect(plan.kind === 'new' && plan.chapters.map(c => c.index)).toEqual([4, 5]);
  });

  it('overwrites from the first changed chapter to the end of the folder', () => {
    const plan = planSync(
      [local(1), local(2, 'Chương 2 mới'), local(3), local(4)],
      range(1, 3).map(i => remote(i)),
    );
    expect(plan).toMatchObject({ kind: 'changed', fromIndex: 2, toIndex: 4, newCount: 1 });
    expect(plan.kind === 'changed' && plan.chapters.map(c => c.index)).toEqual([2, 3, 4]);
  });

  it('has nothing to do when every chapter matches', () => {
    expect(planSync(range(1, 3).map(i => local(i)), range(1, 3).map(i => remote(i)))).toEqual({ kind: 'synced', remoteExtra: 0 });
    expect(planSync(range(1, 2).map(i => local(i)), range(1, 4).map(i => remote(i)))).toEqual({ kind: 'synced', remoteExtra: 2 });
  });

  it('uploads everything to a story without chapters', () => {
    const plan = planSync(range(1, 2).map(i => local(i)), []);
    expect(plan.kind === 'new' && plan.chapters.map(c => c.index)).toEqual([1, 2]);
  });
});
