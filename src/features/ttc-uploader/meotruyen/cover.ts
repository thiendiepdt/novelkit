import { invoke } from '@tauri-apps/api/core';
import { createImage } from '../utils/cropImage';

/** The two JPEGs the site takes (worker/lib/cover.ts there): exact sizes, byte ceilings. */
export const COVER_SIZES = {
  full: { width: 600, height: 800, bytes: 300 * 1024, quality: 0.82 },
  thumb: { width: 180, height: 240, bytes: 60 * 1024, quality: 0.78 },
} as const;

export interface MeoCover {
  full: string;
  thumb: string;
  /** data: URL of the full size, for the preview. */
  previewUrl: string;
}

/** The centered 3:4 part of an image (the crop of the site's own importer). */
export function centerCrop(width: number, height: number): { x: number; y: number; width: number; height: number } {
  const target = 3 / 4;
  if (width / height > target) {
    const w = Math.round(height * target);
    return { x: Math.round((width - w) / 2), y: 0, width: w, height };
  }
  const h = Math.round(width / target);
  return { x: 0, y: Math.round((height - h) / 2), width, height: h };
}

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

function jpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh JPEG.'))), 'image/jpeg', quality),
  );
}

async function render(image: HTMLImageElement, size: (typeof COVER_SIZES)[keyof typeof COVER_SIZES]): Promise<string> {
  const crop = centerCrop(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không vẽ được ảnh bìa.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height);
  // A busy cover can go over the byte ceiling at the usual quality: step down until it fits.
  for (let quality = size.quality; quality >= 0.4; quality -= 0.1) {
    const blob = await jpeg(canvas, quality);
    if (blob.size <= size.bytes) return toBase64(blob);
  }
  throw new Error('Ảnh bìa quá nặng, không nén được xuống cỡ Mèo Truyện nhận.');
}

/** The TTC poster of a story, cut to 3:4 and made into the site's two JPEGs. */
export async function buildMeoCover(posterPath: string): Promise<MeoCover> {
  const dataUri = await invoke<string>('ttc_proxy_image', { path: posterPath });
  const image = await createImage(dataUri);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Ảnh bìa trên TTC không đọc được.');
  const [full, thumb] = [await render(image, COVER_SIZES.full), await render(image, COVER_SIZES.thumb)];
  return { full, thumb, previewUrl: `data:image/jpeg;base64,${full}` };
}
