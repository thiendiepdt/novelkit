/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '@/shared/utils/platform';
import { notifyUser } from '@/shared/utils/notify';
import type { UploadProgressEvent } from '@/features/ttc-uploader/types';
import type { UploadJob, UploadJobOutcome } from './uploadQueueDefs';

interface UploadQueueContextValue {
  jobs: UploadJob[];
  /**
   * Returns the id of the queued job. A `silent` job sends no desktop notification
   * (the caller reports its outcome, e.g. the drip scheduler posting every few minutes).
   */
  addJob: (options: UploadJob['options'], bookTitle: string, opts?: { silent?: boolean }) => string;
  /** Resolves once the job is done, failed, cancelled or removed while pending. */
  waitForJob: (id: string) => Promise<UploadJobOutcome>;
  removeJob: (id: string) => void;
  cancelJob: (id: string) => void;
  clearDone: () => void;
  activeJob?: UploadJob;
  getJobForBook: (bookId: number) => UploadJob | undefined;
}

export const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

export const UploadQueueProvider = ({ children }: { children: ReactNode }) => {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const isProcessingRef = useRef(false);
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  /** Callers of waitForJob, by job id. */
  const waitersRef = useRef(new Map<string, (outcome: UploadJobOutcome) => void>());
  const settle = useCallback((id: string, outcome: UploadJobOutcome) => {
    const resolve = waitersRef.current.get(id);
    if (!resolve) return;
    waitersRef.current.delete(id);
    resolve(outcome);
  }, []);
  const waitForJob = useCallback(
    (id: string) => new Promise<UploadJobOutcome>((resolve) => waitersRef.current.set(id, resolve)),
    [],
  );

  const addJob = useCallback((options: UploadJob['options'], bookTitle: string, opts?: { silent?: boolean }) => {
    const newJob: UploadJob = {
      id: `${options.book_id}-${Date.now()}`,
      bookTitle,
      options,
      status: 'pending',
      progress: null,
      timestamp: Date.now(),
      silent: opts?.silent || undefined,
    };
    setJobs((prev) => [...prev, newJob]);
    return newJob.id;
  }, []);

  const removeJob = useCallback((id: string) => {
    if (jobsRef.current.find((j) => j.id === id)?.status === 'pending') {
      settle(id, { status: 'error', error: 'Đã xóa khỏi hàng đợi' });
    }
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }, [settle]);

  const cancelJob = useCallback((id: string) => {
    // A pending job never reaches processNextJob: settle its waiter here.
    if (jobsRef.current.find((j) => j.id === id)?.status === 'pending') {
      settle(id, { status: 'error', error: 'Bị hủy bởi người dùng' });
    }
    setJobs((prev) => {
      const job = prev.find(j => j.id === id);
      if (!job) return prev;
      
      if (job.status === 'uploading') {
        return prev.map(j => j.id === id ? { ...j, status: 'error' as const, error: 'Bị hủy bởi người dùng' } : j);
      } else if (job.status === 'pending') {
        return prev.filter(j => j.id !== id);
      }
      return prev;
    });

    // Emit cancel event outside setState to avoid fire-and-forget inside updater
    if (isTauri()) {
      import('@tauri-apps/api/event').then(({ emit }) => {
        emit(`ttc://cancel-upload-${id}`);
      });
    }
  }, [settle]);

  const clearDone = useCallback(() => {
    setJobs((prev) => prev.filter((job) => job.status !== 'done' && job.status !== 'error'));
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    
    let unlisten: () => void;
    const setup = async () => {
      unlisten = await listen<UploadProgressEvent>('ttc://upload-progress', (event) => {
        setJobs((prev) => {
          const jobId = event.payload.job_id;
          if (!jobId) return prev; // Ignore events without job_id (old schema or other events)

          const newJobs = [...prev];
          const activeIndex = newJobs.findIndex((j) => j.id === jobId);
          if (activeIndex !== -1) {
            newJobs[activeIndex] = {
              ...newJobs[activeIndex],
              progress: event.payload,
            };
          }
          return newJobs;
        });
      });
    };
    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const [queueTick, setQueueTick] = useState(0);

  const processNextJob = useCallback(async (job: UploadJob) => {
    isProcessingRef.current = true;
    
    setJobs((prev) => 
      prev.map((j) => j.id === job.id ? { ...j, status: 'uploading' as const } : j)
    );

    try {
      await invoke('ttc_upload_chapters', { options: job.options, jobId: job.id });
      setJobs((prev) => 
        prev.map((j) => j.id === job.id ? { ...j, status: 'done' as const } : j)
      );
      settle(job.id, { status: 'done' });
      if (!job.silent) notifyUser('Đăng chương hoàn tất', `Đã tải lên xong truyện "${job.bookTitle}"`);
    } catch (e: unknown) {
      setJobs((prev) => 
        prev.map((j) => j.id === job.id ? { ...j, status: 'error' as const, error: String(e) } : j)
      );
      settle(job.id, { status: 'error', error: String(e) });
      if (!job.silent) notifyUser('Lỗi đăng chương', `Có lỗi xảy ra với truyện "${job.bookTitle}": ${String(e)}`);
    } finally {
      isProcessingRef.current = false;
      setQueueTick((t) => t + 1); // Trigger re-evaluation of pending jobs
    }
  }, [settle]);

  useEffect(() => {
    if (!isTauri()) return;
    if (isProcessingRef.current) return;

    const pendingJob = jobs.find((j) => j.status === 'pending');
    const isUploading = jobs.some((j) => j.status === 'uploading');

    if (!isUploading && pendingJob) {
      processNextJob(pendingJob);
    }
  }, [jobs, queueTick, processNextJob]);

  const getJobForBook = useCallback((bookId: number) => {
    // Return the most recent job for this book
    return jobs.slice().reverse().find(j => j.options.book_id === bookId);
  }, [jobs]);

  const activeJob = jobs.find((j) => j.status === 'uploading');

  return (
    <UploadQueueContext.Provider value={{ jobs, addJob, waitForJob, removeJob, cancelJob, clearDone, activeJob, getJobForBook }}>
      {children}
    </UploadQueueContext.Provider>
  );
};

export const useUploadQueueContext = () => {
  const context = useContext(UploadQueueContext);
  if (!context) {
    throw new Error('useUploadQueueContext must be used within an UploadQueueProvider');
  }
  return context;
};
