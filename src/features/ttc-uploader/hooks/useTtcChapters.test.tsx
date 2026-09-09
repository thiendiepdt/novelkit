import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/features/settings/context/SettingsContext';
import { UploadQueueContext } from '@/shared/context/UploadQueueContext';
import type { UploadJob } from '@/shared/context/uploadQueueDefs';
import { useTtcChapters } from './useTtcChapters';
import type { TtcStory } from '../types';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

const BOOK = { id: 42, title: 'Test' } as unknown as TtcStory;

const makeJob = (status: UploadJob['status']): UploadJob => ({
  id: 'job-1',
  bookTitle: 'Test',
  options: { book_id: BOOK.id, chapters: [], delay_ms: 0, price: 0 },
  status,
  progress: null,
  timestamp: 0,
});

const fetchCalls = () => invokeMock.mock.calls.filter(c => c[0] === 'ttc_fetch_chapters');

describe('useTtcChapters post-upload refetch', () => {
  let job: UploadJob | undefined;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <SettingsProvider>
      <UploadQueueContext.Provider
        value={{
          jobs: [],
          addJob: vi.fn(),
          removeJob: vi.fn(),
          cancelJob: vi.fn(),
          clearDone: vi.fn(),
          getJobForBook: () => job,
        }}
      >
        {children}
      </UploadQueueContext.Provider>
    </SettingsProvider>
  );

  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'ttc_fetch_chapters') return { chapters: [], totalPages: 1, totalChapters: 0 };
      throw new Error(`unexpected invoke ${cmd}`);
    });
  });

  it('refetches both remote lists when the job goes uploading -> done', async () => {
    job = makeJob('uploading');
    const { rerender } = renderHook(() => useTtcChapters(BOOK), { wrapper });
    expect(fetchCalls()).toHaveLength(0);

    job = makeJob('done');
    rerender();

    await waitFor(() => {
      // paginated list (limit = chaptersLimit, default 10) + full list (limit 1000)
      const limits = fetchCalls().map(c => (c[1] as { limit: number }).limit).sort((a, b) => a - b);
      expect(limits).toEqual([10, 1000]);
    });
  });

  it('refetches when the job ends in error (batches may have partially succeeded)', async () => {
    job = makeJob('uploading');
    const { rerender } = renderHook(() => useTtcChapters(BOOK), { wrapper });

    job = { ...makeJob('error'), error: 'HTTP 403' };
    rerender();

    await waitFor(() => expect(fetchCalls()).toHaveLength(2));
  });

  it('does not refetch while the job is still pending or uploading', async () => {
    job = makeJob('pending');
    const { rerender } = renderHook(() => useTtcChapters(BOOK), { wrapper });
    job = makeJob('uploading');
    rerender();
    await new Promise(r => setTimeout(r, 50));
    expect(fetchCalls()).toHaveLength(0);
  });
});
