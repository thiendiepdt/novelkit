import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '@/shared/utils/platform';
import type { DownloadAllProgressEvent } from '@/shared/types/download';
import { DownloadQueueContext } from './downloadQueueDefs';
import type { DownloadJob } from './downloadQueueDefs';

export const DownloadQueueProvider = ({ children }: { children: ReactNode }) => {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const isProcessingRef = useRef(false);

  // Thêm job mới vào hàng đợi
  const addJob = useCallback((options: DownloadJob['options']) => {
    const newJob: DownloadJob = {
      id: `${options.book_id}-${Date.now()}`,
      bookTitle: options.book_title,
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

  const cancelJob = useCallback(async (id: string) => {
    setJobs((prev) => {
      const job = prev.find(j => j.id === id);
      if (!job) return prev;
      
      if (job.status === 'downloading') {
        // Phát sự kiện hủy xuống backend
        import('@tauri-apps/api/event').then(({ emit }) => {
          emit(`ttc://cancel-download-${id}`);
        });
        return prev.map(j => j.id === id ? { ...j, status: 'error' as const, error: 'Bị hủy bởi người dùng' } : j);
      } else if (job.status === 'pending') {
        // Chỉ cần xóa khỏi hàng đợi
        return prev.filter(j => j.id !== id);
      }
      return prev;
    });
  }, []);

  const clearDone = useCallback(() => {
    setJobs((prev) => prev.filter((job) => job.status !== 'done' && job.status !== 'error'));
  }, []);

  // Set up listener for progress
  useEffect(() => {
    if (!isTauri()) return;
    
    let unlisten: () => void;
    const setup = async () => {
      unlisten = await listen<DownloadAllProgressEvent>('ttc://download-all-progress', (event) => {
        setJobs((prev) => {
          const newJobs = [...prev];
          const activeIndex = newJobs.findIndex((j) => j.status === 'downloading');
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

  // Process queue
  useEffect(() => {
    if (!isTauri()) return;
    if (isProcessingRef.current) return;

    const pendingJobIndex = jobs.findIndex((j) => j.status === 'pending');
    const isDownloading = jobs.some((j) => j.status === 'downloading');

    if (!isDownloading && pendingJobIndex !== -1) {
      processNextJob(jobs[pendingJobIndex]);
    }
  }, [jobs]);

  const processNextJob = async (job: DownloadJob) => {
    isProcessingRef.current = true;
    
    // Mark as downloading
    setJobs((prev) => 
      prev.map((j) => j.id === job.id ? { ...j, status: 'downloading' as const } : j)
    );

    try {
      await invoke('ttc_download_all_chapters', { options: job.options, jobId: job.id });
      // Xong
      setJobs((prev) => 
        prev.map((j) => j.id === job.id ? { ...j, status: 'done' as const } : j)
      );
    } catch (e: unknown) {
      setJobs((prev) => 
        prev.map((j) => j.id === job.id ? { ...j, status: 'error' as const, error: String(e) } : j)
      );
    } finally {
      isProcessingRef.current = false;
      // Kích hoạt useEffect tiếp theo bằng cách thay đổi state
      setJobs((prev) => [...prev]); 
    }
  };

  const activeJob = jobs.find((j) => j.status === 'downloading');

  return (
    <DownloadQueueContext.Provider value={{ jobs, addJob, removeJob, cancelJob, clearDone, activeJob }}>
      {children}
    </DownloadQueueContext.Provider>
  );
};
