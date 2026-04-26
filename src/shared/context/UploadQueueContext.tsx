/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '@/shared/utils/platform';
import type { UploadProgressEvent } from '@/features/ttc-uploader/types';
import type { UploadJob } from './uploadQueueDefs';

interface UploadQueueContextValue {
  jobs: UploadJob[];
  addJob: (options: UploadJob['options'], bookTitle: string) => void;
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

  const notifyUser = async (title: string, body: string) => {
    if (isTauri()) {
      try {
        const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === 'granted';
        }
        if (permissionGranted) {
          sendNotification({ title, body });
        }
      } catch (e) {
        console.error('Failed to send native notification:', e);
      }
    } else {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      }
    }
  };

  const addJob = useCallback((options: UploadJob['options'], bookTitle: string) => {
    const newJob: UploadJob = {
      id: `${options.book_id}-${Date.now()}`,
      bookTitle,
      options,
      status: 'pending',
      progress: null,
      timestamp: Date.now(),
    };
    setJobs((prev) => [...prev, newJob]);
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }, []);

  const cancelJob = useCallback((id: string) => {
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
  }, []);

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
      notifyUser('Đăng chương hoàn tất', `Đã tải lên xong truyện "${job.bookTitle}"`);
    } catch (e: unknown) {
      setJobs((prev) => 
        prev.map((j) => j.id === job.id ? { ...j, status: 'error' as const, error: String(e) } : j)
      );
      notifyUser('Lỗi đăng chương', `Có lỗi xảy ra với truyện "${job.bookTitle}": ${String(e)}`);
    } finally {
      isProcessingRef.current = false;
      setQueueTick((t) => t + 1); // Trigger re-evaluation of pending jobs
    }
  }, []);

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
    <UploadQueueContext.Provider value={{ jobs, addJob, removeJob, cancelJob, clearDone, activeJob, getJobForBook }}>
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
