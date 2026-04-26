import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Proxied poster image — fetched via Rust backend to bypass CORS.
 * Displays a shimmer placeholder while loading.
 */
export default function ProxiedImage({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    invoke<string>('ttc_proxy_image', { path })
      .then((dataUri) => {
        if (!cancelled) setSrc(dataUri);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!src) {
    return (
      <div
        className={`${className ?? ''} bg-bg-hover border border-border-main rounded-lg animate-pulse`}
      />
    );
  }

  return <img src={src} alt={alt} className={`${className ?? ''} rounded-lg object-cover`} />;
}
