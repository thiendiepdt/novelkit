import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UploadQueueContext } from '@/shared/context/UploadQueueContext';
import type { UploadJob } from '@/shared/context/uploadQueueDefs';
import type { UploadProgressEvent } from '@/features/ttc-uploader/types';
import UploadQueueManager from './UploadQueueManager';

const SERVER_MSG = '⚠️ Tiêu đề chương có từ ngữ vi phạm (đĩ). Vui lòng chỉnh sửa!';

const makeProgress = (overrides: Partial<UploadProgressEvent>): UploadProgressEvent => ({
  job_id: 'job-1',
  current: 0,
  total: 300,
  current_title: '',
  success: 0,
  failed: 0,
  status: 'uploading',
  message: null,
  ...overrides,
});

const makeJob = (status: UploadJob['status'], progress: UploadProgressEvent | null, error?: string): UploadJob => ({
  id: 'job-1',
  bookTitle: 'Test Book',
  options: { book_id: 42, chapters: [], delay_ms: 0, price: 0 },
  status,
  progress,
  error,
  timestamp: 0,
});

const renderWithJobs = (jobs: UploadJob[]) => {
  render(
    <UploadQueueContext.Provider
      value={{
        jobs,
        addJob: vi.fn(),
        removeJob: vi.fn(),
        cancelJob: vi.fn(),
        clearDone: vi.fn(),
        getJobForBook: () => undefined,
      }}
    >
      <UploadQueueManager />
    </UploadQueueContext.Provider>
  );
  // Open the dropdown (the trigger is the only button before opening)
  fireEvent.click(screen.getByRole('button'));
};

describe('UploadQueueManager error reporting', () => {
  it('shows the TTC server reason when a job was stopped by a failed batch', () => {
    // Batch 1 (chapters 1-100) succeeded, batch 2 was rejected → Rust returned Err(reason)
    const reason = `Chương 101–200: ${SERVER_MSG}`;
    const progress = makeProgress({ current: 200, success: 100, failed: 100, status: 'error', message: reason });
    renderWithJobs([makeJob('error', progress, reason)]);

    expect(screen.getByText(reason)).toBeTruthy();
    expect(screen.queryByText('Đã hoàn tất')).toBeNull();
  });

  it('shows a plain success state when every batch went through', () => {
    const progress = makeProgress({ current: 300, success: 300, status: 'done', message: 'Hoàn tất: 300 thành công, 0 thất bại' });
    renderWithJobs([makeJob('done', progress)]);

    expect(screen.getByText('Đã hoàn tất')).toBeTruthy();
  });
});
