import { describe, it, expect } from 'vitest';
import { sourceSite } from './sourceSite';

describe('sourceSite', () => {
  it('names the known sources by their short name', () => {
    expect(sourceSite('https://fanqienovel.com/page/7582401378450951193')).toEqual({
      name: 'Fanqie',
      url: 'https://fanqienovel.com/page/7582401378450951193',
    });
    expect(sourceSite('https://www.qidian.com/book/1047881520/')?.name).toBe('Qidian');
    expect(sourceSite('https://book.sfacg.com/Novel/601431/')?.name).toBe('SFACG');
    expect(sourceSite('https://b.faloo.com/1482109.html')?.name).toBe('Faloo');
    expect(sourceSite('https://book.qq.com/book-detail/60272586')?.name).toBe('BookQQ');
  });

  it('falls back to the host for a site the app does not read', () => {
    expect(sourceSite('https://www.example-novels.cn/book/12')).toEqual({
      name: 'example-novels.cn',
      url: 'https://www.example-novels.cn/book/12',
    });
  });

  it('has nothing for a story without a web link', () => {
    for (const link of [null, undefined, '', '   ', 'không có', 'javascript:alert(1)', 'file:///C:/x.txt']) {
      expect(sourceSite(link)).toBeNull();
    }
  });
});
