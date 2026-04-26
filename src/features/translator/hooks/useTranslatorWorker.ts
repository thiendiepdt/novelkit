import { useEffect, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import type { TranslatorWorkerAPI } from '../engine/translator.worker';

// Vite worker syntax
import TranslatorWorker from '../engine/translator.worker?worker';

export function useTranslatorWorker() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const workerApiRef = useRef<Comlink.Remote<TranslatorWorkerAPI> | null>(null);

  useEffect(() => {
    const worker = new TranslatorWorker();
    const api = Comlink.wrap<TranslatorWorkerAPI>(worker);
    workerApiRef.current = api;

    let mounted = true;
    
    const initWorker = async () => {
      try {
        setIsLoading(true);
        // Call init to fetch and cache dictionaries
        // Normally we'd use an env variable for CDN, defaulting to local
        await api.init();
        if (mounted) {
          setIsReady(true);
        }
      } catch (e) {
        console.error('Failed to initialize translator worker', e);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initWorker();

    return () => {
      mounted = false;
      worker.terminate();
    };
  }, []);

  return {
    isReady,
    isLoading,
    api: workerApiRef.current,
  };
}
