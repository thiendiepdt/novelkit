import { useContext } from 'react';
import { DownloadQueueContext } from './downloadQueueDefs';
import type { DownloadQueueContextType } from './downloadQueueDefs';

export const useDownloadQueue = (): DownloadQueueContextType => {
  const context = useContext(DownloadQueueContext);
  if (context === undefined) {
    throw new Error('useDownloadQueue must be used within a DownloadQueueProvider');
  }
  return context;
};
