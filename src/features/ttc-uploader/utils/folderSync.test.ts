import { describe, it, expect } from 'vitest';
import { folderVerdict } from './folderSync';
import type { ParsedChapter } from '../types';

const ch = (index: number, title = `Chương ${index}: Tên ${index}`): ParsedChapter => ({ index, title, content: '', word_count: 1000, file_name: 'x.txt' });
const range = (n: number) => Array.from({ length: n }, (_, i) => ch(i + 1));

describe('folderVerdict', () => {
  it('finds chapters TTC does not have yet', () => {
    expect(folderVerdict(range(175), { total_chapters: 171, latest_chapter_title: 'Chương 171: Tên 171' })).toEqual({
      kind: 'ahead',
      localCount: 175,
      remoteCount: 171,
    });
  });

  it('finds a latest chapter that differs from the folder', () => {
    const local = [...range(9), ch(10, 'Chương 10: Tên mới')];
    expect(folderVerdict(local, { total_chapters: 10, latest_chapter_title: 'Chương 10: Tên 10' })).toEqual({
      kind: 'changed',
      chapter: 10,
      local: 'Chương 10: Tên mới',
      remote: 'Chương 10: Tên 10',
    });
  });

  it('is synced when the counts and the latest title match (spaces aside), or TTC is ahead', () => {
    expect(folderVerdict(range(10), { total_chapters: 10, latest_chapter_title: ' Chương 10: Tên 10 ' })).toEqual({ kind: 'synced', localCount: 10 });
    expect(folderVerdict(range(8), { total_chapters: 10, latest_chapter_title: 'Chương 10: Tên 10' }).kind).toBe('synced');
  });

  it('counts every chapter of a story still empty on TTC as new', () => {
    expect(folderVerdict(range(3), { total_chapters: 0, latest_chapter_title: null })).toMatchObject({ kind: 'ahead', remoteCount: 0 });
  });

  it('reports a folder with no chapter', () => {
    expect(folderVerdict([], { total_chapters: 3, latest_chapter_title: null }).kind).toBe('error');
  });
});
