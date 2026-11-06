import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { UploadQueueProvider, useUploadQueueContext } from './UploadQueueContext';
import type { UploadOptions } from '@/features/ttc-uploader/types';

// Not in Tauri: jobs stay pending, which is what the waiter tests need.
vi.mock('@/shared/utils/platform', () => ({ isTauri: () => false }));

const wrapper = ({ children }: { children: ReactNode }) => <UploadQueueProvider>{children}</UploadQueueProvider>;
const OPTIONS: UploadOptions = { book_id: 7, chapters: [] };

describe('UploadQueueContext waitForJob', () => {
  it('settles when a pending job is cancelled', async () => {
    const { result } = renderHook(() => useUploadQueueContext(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.addJob(OPTIONS, 'Truyện', { silent: true });
    });
    expect(result.current.jobs[0]).toMatchObject({ id, silent: true, status: 'pending' });

    const outcome = result.current.waitForJob(id);
    act(() => result.current.cancelJob(id));
    await expect(outcome).resolves.toEqual({ status: 'error', error: 'Bị hủy bởi người dùng' });
    expect(result.current.jobs).toHaveLength(0);
  });

  it('settles when a pending job is removed', async () => {
    const { result } = renderHook(() => useUploadQueueContext(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.addJob(OPTIONS, 'Truyện');
    });
    expect(result.current.jobs[0].silent).toBeUndefined();

    const outcome = result.current.waitForJob(id);
    act(() => result.current.removeJob(id));
    await expect(outcome).resolves.toMatchObject({ status: 'error' });
  });
});
