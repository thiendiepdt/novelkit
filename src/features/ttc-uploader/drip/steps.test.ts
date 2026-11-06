import { describe, it, expect } from 'vitest';
import { decideDripStep, stepLabel } from './steps';
import type { ParsedChapter, TtcChapter } from '../types';

const local = (n: number, from = 1): ParsedChapter[] =>
  Array.from({ length: n }, (_, i) => ({
    index: from + i,
    title: `Chương ${from + i}`,
    content: '',
    word_count: 2000,
    file_name: '',
  }));

const remote = (n: number, from = 1): TtcChapter[] =>
  Array.from({ length: n }, (_, i) => ({
    chapterNumber: from + i,
    title: `Chương ${from + i}`,
    wordCount: 2000,
    views: 0,
    status: null,
    chapter_price: 0,
    last_chap_updated: null,
  }));

describe('decideDripStep', () => {
  it('uploads the initial batch at once on a story without chapters', () => {
    const step = decideDripStep(local(500), [], 200);
    expect(step).toMatchObject({ kind: 'initial', from: 1, to: 200 });
    expect(step.kind !== 'caught-up' && step.chapters).toHaveLength(200);
  });

  it('finishes an interrupted initial batch', () => {
    expect(decideDripStep(local(500), remote(150), 200)).toMatchObject({ kind: 'initial', from: 151, to: 200 });
  });

  it('drips one chapter after the initial batch', () => {
    const step = decideDripStep(local(500), remote(200), 200);
    expect(step).toMatchObject({ kind: 'drip', from: 201, to: 201 });
    expect(step.kind !== 'caught-up' && step.chapters).toHaveLength(1);
  });

  it('drips from the start with no initial batch', () => {
    expect(decideDripStep(local(10), [], 0)).toMatchObject({ kind: 'drip', from: 1, to: 1 });
  });

  it('drips when TTC already has more than the initial batch', () => {
    expect(decideDripStep(local(500), remote(300), 100)).toMatchObject({ kind: 'drip', from: 301 });
  });

  it('resyncs an edited chapter up to the last one on TTC before dripping', () => {
    const edited = local(500);
    edited[100] = { ...edited[100], title: 'Chương 101: sửa lại' };
    const step = decideDripStep(edited, remote(200), 200);
    expect(step).toMatchObject({ kind: 'resync', from: 101, to: 200 });
    expect(step.kind !== 'caught-up' && step.chapters).toHaveLength(100);
  });

  it('is caught up when the folder has nothing new', () => {
    expect(decideDripStep(local(200), remote(200), 100)).toEqual({ kind: 'caught-up', lastOnTtc: 200 });
    expect(decideDripStep(local(150), remote(200), 100)).toEqual({ kind: 'caught-up', lastOnTtc: 200 });
  });

  it('follows the TTC numbering with skipped chapters', () => {
    // Chapters 1–10 were posted elsewhere; the folder starts at 11.
    expect(decideDripStep(local(20, 11), remote(15), 0)).toMatchObject({ kind: 'drip', from: 16 });
  });
});

describe('stepLabel', () => {
  it('names the kind and the range', () => {
    expect(stepLabel({ kind: 'drip', chapters: [], from: 201, to: 201 })).toBe('nhỏ giọt chương 201');
    expect(stepLabel({ kind: 'initial', chapters: [], from: 1, to: 200 })).toBe('đợt đầu chương 1–200');
    expect(stepLabel({ kind: 'resync', chapters: [], from: 101, to: 200 })).toBe('đồng bộ lại chương 101–200');
  });
});
