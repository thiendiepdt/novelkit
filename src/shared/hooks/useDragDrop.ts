import { useState, useCallback, useRef } from 'react';

interface UseDragDropOptions {
  /** File extension filter (e.g. '.txt'). Pass null to accept any file. */
  accept?: string;
  /** Callback when a valid file is dropped. */
  onFile: (file: File) => void;
}

interface UseDragDropReturn {
  isDragOver: boolean;
  dragHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * Hook to handle drag & drop file uploads.
 * Uses a counter-based approach to prevent flickering from child elements.
 */
export function useDragDrop({ accept, onFile }: UseDragDropOptions): UseDragDropReturn {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsDragOver(true);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      if (accept && !file.name.endsWith(accept)) return;
      onFile(file);
    },
    [accept, onFile],
  );

  return {
    isDragOver,
    dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
