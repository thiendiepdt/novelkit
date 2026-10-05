import { describe, it, expect } from 'vitest';
import { detectSource } from './detect';

describe('detectSource: sangtacviet mirror links', () => {
  // The examples given by the user, on one of the mirror's bare IPs.
  const cases: [string, string, string][] = [
    ['http://14.225.254.182/truyen/faloo/1/1550416/', 'faloo', 'https://b.faloo.com/1550416.html'],
    ['http://14.225.254.182/truyen/qidian/1/1050951159/', 'qidian', 'https://www.qidian.com/book/1050951159/'],
    ['http://14.225.254.182/truyen/fanqie/1/7682419789737774142/', 'fanqie', 'https://fanqienovel.com/page/7682419789737774142'],
    ['http://14.225.254.182/truyen/ciweimao/1/100505058/', 'ciweimao', 'https://www.ciweimao.com/book/100505058'],
    ['http://14.225.254.182/truyen/jjwxc/1/7053410/', 'jjwxc', 'https://www.jjwxc.net/onebook.php?novelid=7053410'],
    ['http://14.225.254.182/truyen/sfacg/1/785048/', 'sfacg', 'https://book.sfacg.com/Novel/785048/'],
    ['http://14.225.254.182/truyen/qimao/1/12568035/', 'qimao', 'https://www.qimao.com/shuku/12568035/'],
  ];

  it.each(cases)('maps %s to the original book', (link, source, canonical) => {
    const ref = detectSource(link);
    expect(ref?.source).toBe(source);
    expect(ref?.link).toBe(canonical);
  });

  it('ignores the host: the mirror lives on many domains and IPs', () => {
    for (const link of [
      'https://sangtacviet.vip/truyen/qidian/1/1050951159/',
      'https://sangtacviet.app/truyen/qidian/1/1050951159/',
      'http://103.90.227.165/truyen/qidian/1/1050951159/',
    ]) {
      expect(detectSource(link)?.link).toBe('https://www.qidian.com/book/1050951159/');
    }
  });

  it('accepts chapter links and a query string, as the mirror adds them', () => {
    expect(detectSource('http://14.225.254.182/truyen/faloo/1/1550416/12345678/')?.link).toBe('https://b.faloo.com/1550416.html');
    expect(detectSource('https://sangtacviet.vip/truyen/jjwxc/1/7053410/?chapter=3')?.link).toBe(
      'https://www.jjwxc.net/onebook.php?novelid=7053410',
    );
  });

  it('does not match mirror paths for sites the app cannot read', () => {
    expect(detectSource('http://14.225.254.182/truyen/ttv/1/12345/')).toBeNull();
    expect(detectSource('http://14.225.254.182/truyen/qidian/1/notanid/')).toBeNull();
    expect(detectSource('http://14.225.254.182/truyen/')).toBeNull();
  });
});
