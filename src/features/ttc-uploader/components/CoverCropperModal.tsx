import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage';

interface CoverCropperModalProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedBytes: number[], mimeType: string) => Promise<void>;
}

export function CoverCropperModal({ imageSrc, onClose, onCropComplete }: CoverCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropCompleteHandler = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      setIsProcessing(true);
      const croppedBytes = await getCroppedImg(imageSrc, croppedAreaPixels, { horizontal: false, vertical: false });
      if (croppedBytes) {
        // Convert Uint8Array to regular array for IPC transfer
        const bytesArray = Array.from(croppedBytes);
        await onCropComplete(bytesArray, 'image/jpeg');
      }
    } catch (e) {
      console.error('Lỗi khi cắt ảnh', e);
      alert('Có lỗi xảy ra khi cắt ảnh.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div 
        className="bg-bg-card border border-border-main rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-main flex justify-between items-center bg-bg-hover/30">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <span className="text-jade">✂</span> Cắt Ảnh Bìa
          </h2>
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="text-text-dim hover:text-crimson transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-bg-hover"
          >
            ✕
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative w-full h-[60vh] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={195 / 260}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropCompleteHandler}
          />
        </div>

        {/* Controls */}
        <div className="p-4 bg-bg-primary border-b border-border-main flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-dim w-12 font-medium">Thu Phóng</span>
            <input 
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-gold"
            />
            <span className="text-xs text-text-primary w-8 text-right">{zoom.toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-dim w-12 font-medium">Xoay</span>
            <input 
              type="range"
              value={rotation}
              min={0}
              max={360}
              step={1}
              aria-labelledby="Rotation"
              onChange={(e) => setRotation(Number(e.target.value))}
              className="flex-1 accent-gold"
            />
            <span className="text-xs text-text-primary w-8 text-right">{rotation}°</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex justify-between items-center bg-bg-hover/50">
          <div className="text-xs text-text-dim">
            Kích thước chuẩn: <strong className="text-text-primary">195x260 px</strong>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button 
              onClick={handleSave}
              disabled={isProcessing}
              className="px-6 py-2 bg-jade text-white font-bold text-sm rounded-lg hover:bg-jade/90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang xử lý...
                </>
              ) : (
                'CẮT ẢNH & TẢI LÊN'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
