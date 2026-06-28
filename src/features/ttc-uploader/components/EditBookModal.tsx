import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Check } from 'lucide-react';
import { Select } from '@/shared/components';
import { fetchEditBookForm, submitEditBookForm, uploadCover } from '../api';
import type { EditBookForm, EditBookData } from '../types';
import { CoverCropperModal } from './CoverCropperModal';

interface EditBookModalProps {
  bookId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditBookModal({ bookId, onClose, onSuccess }: EditBookModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formConfig, setFormConfig] = useState<EditBookForm | null>(null);
  const [formData, setFormData] = useState<EditBookData | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchEditBookForm(bookId);
        if (mounted) {
          setFormConfig(data);
          setFormData(data.data);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Không thể tải thông tin truyện');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [bookId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleSubCategoryChange = (index: number, value: string) => {
    setFormData(prev => {
      if (!prev) return null;
      const newSubs = [...prev.sub_categories];
      newSubs[index] = value;
      return { ...prev, sub_categories: newSubs };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formConfig || !formData) return;

    try {
      setSubmitting(true);
      setError(null);
      await submitEditBookForm(formConfig.actionUrl, formConfig.csrfToken, formData);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi khi cập nhật truyện');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadCover = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
      });
      if (!file) return;

      const fileBytes = await invoke<number[]>('ttc_read_local_file', { path: file as string });
      const blob = new Blob([new Uint8Array(fileBytes)]);
      const url = URL.createObjectURL(blob);
      setCropImageSrc(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi khi mở file ảnh');
    }
  };

  const handleCropComplete = async (croppedBytes: number[], mimeType: string) => {
    try {
      setUploadingCover(true);
      setError(null);
      await uploadCover(bookId, croppedBytes, mimeType);

      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi khi upload ảnh bìa');
    } finally {
      setUploadingCover(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div
        className="bg-bg-card border border-border-main rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-main flex justify-between items-center flex-shrink-0 bg-bg-hover/30 rounded-t-xl">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <span className="text-gold">✏</span> Cập Nhật Truyện
          </h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-crimson transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-bg-hover"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 relative min-h-[300px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-card/80 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-border-main border-t-gold rounded-full animate-spin"></div>
                <span className="text-sm text-text-secondary">Đang tải thông tin...</span>
              </div>
            </div>
          )}

          {error && !formConfig && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-crimson text-sm bg-crimson/10 px-4 py-2 rounded-lg border border-crimson/30">
                {error}
              </div>
            </div>
          )}

          {formConfig && formData && (
            <form id="editBookForm" onSubmit={handleSubmit} className="flex flex-col gap-6">

              {/* Error Alert */}
              {error && (
                <div className="p-3 bg-crimson/10 border border-crimson/30 rounded-lg text-sm text-crimson mb-2">
                  {error}
                </div>
              )}

              {/* Read-only info banner */}
              <div className="flex flex-wrap gap-4 p-3 bg-bg-hover/50 rounded-lg border border-border-main text-xs">
                <div className="flex flex-col gap-1 w-[45%]">
                  <span className="text-text-dim font-medium uppercase tracking-wider text-[10px]">Tên truyện</span>
                  <span className="text-text-secondary font-semibold">{formData.title}</span>
                </div>
                <div className="flex flex-col gap-1 w-[45%]">
                  <span className="text-text-dim font-medium uppercase tracking-wider text-[10px]">Tên tiếng trung</span>
                  <span className="text-text-secondary">{formData.chinese_title || 'N/A'}</span>
                </div>
                <div className="flex flex-col gap-1 w-[45%] mt-2">
                  <span className="text-text-dim font-medium uppercase tracking-wider text-[10px]">Giới tính & Loại</span>
                  <span className="text-text-secondary">{formData.gender} • {formData.type === 'truyen-dich' ? 'Truyện Dịch' : formData.type === 'truyen-cv' ? 'Truyện Convert' : 'Sáng Tác'} • {formData.story_length}</span>
                </div>
                <div className="flex flex-col gap-1 w-[45%] mt-2">
                  <span className="text-text-dim font-medium uppercase tracking-wider text-[10px]">Link gốc</span>
                  <a href={formData.chinese_link} target="_blank" rel="noreferrer" className="text-gold hover:underline truncate">
                    {formData.chinese_link || 'Không có'}
                  </a>
                </div>

                <div className="flex flex-col gap-2 w-full mt-2 border-t border-border-main/30 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-text-dim font-medium uppercase tracking-wider text-[10px]">Ảnh bìa</span>
                    <button
                      type="button"
                      onClick={handleUploadCover}
                      disabled={uploadingCover}
                      className="px-3 py-1.5 bg-purple/10 text-purple border border-purple/20 text-xs font-bold rounded-lg hover:bg-purple/20 hover:border-purple/30 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      {uploadingCover ? (
                        <>
                          <div className="w-3 h-3 border-2 border-purple border-t-transparent rounded-full animate-spin"></div>
                          Đang tải lên...
                        </>
                      ) : (
                        '📸 Đổi ảnh bìa'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-text-dim font-medium uppercase tracking-wider block">
                    Tên tác giả hiển thị <span className="text-crimson">*</span>
                  </label>
                  <input
                    type="text"
                    name="author"
                    value={formData.author}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-bg-hover border border-border-main rounded-lg text-sm text-text-primary focus:outline-none focus:border-gold/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-text-dim font-medium uppercase tracking-wider block">
                    Thể loại <span className="text-crimson">*</span>
                  </label>
                  <Select
                    name="category"
                    value={formData.category}
                    onChange={handleChange as React.ChangeEventHandler<HTMLSelectElement>}
                    required
                    fullWidth
                    className="text-sm"
                  >
                    <option value="" disabled>Vui lòng chọn thể loại</option>
                    {formConfig.options.categories.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>

                {/* Tính cách */}
                <div className="space-y-2">
                  <label className="text-xs text-text-dim font-medium uppercase tracking-wider block">Tính cách</label>
                  <Select
                    value={formData.sub_categories[0] || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSubCategoryChange(0, e.target.value)}
                    fullWidth
                    className="text-sm"
                  >
                    <option value="">Vui lòng chọn tính cách</option>
                    {formConfig.options.subCategoriesTichCach.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>

                {/* Bối cảnh */}
                <div className="space-y-2">
                  <label className="text-xs text-text-dim font-medium uppercase tracking-wider block">Bối cảnh</label>
                  <Select
                    value={formData.sub_categories[1] || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSubCategoryChange(1, e.target.value)}
                    fullWidth
                    className="text-sm"
                  >
                    <option value="">Vui lòng chọn bối cảnh</option>
                    {formConfig.options.subCategoriesBoiCanh.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>

                {/* Lưu phái */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs text-text-dim font-medium uppercase tracking-wider block">Lưu phái</label>
                  <Select
                    value={formData.sub_categories[2] || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSubCategoryChange(2, e.target.value)}
                    fullWidth
                    className="text-sm"
                  >
                    <option value="">Vui lòng chọn lưu phái</option>
                    {formConfig.options.subCategoriesLuuPhai.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>

                {/* Giới thiệu */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs text-text-dim font-medium uppercase tracking-wider block">Giới thiệu</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={8}
                    className="w-full px-3 py-3 bg-bg-hover border border-border-main rounded-lg text-sm text-text-primary focus:outline-none focus:border-gold/50 resize-y"
                    placeholder="Nhập nội dung giới thiệu truyện..."
                  />
                </div>

                {/* Trạng thái (Segmented Control style) */}
                <div className="space-y-3 md:col-span-2 bg-bg-primary p-4 rounded-lg border border-gold/20">
                  <label className="text-xs text-gold font-bold uppercase tracking-wider block">Tình trạng truyện</label>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${formData.status === 'ongoing' ? 'bg-gold/10 border-gold text-gold font-semibold shadow-[0_0_10px_rgba(201,169,110,0.2)]' : 'bg-bg-hover border-border-main text-text-secondary hover:border-text-dim'}`}>
                      <input type="radio" name="status" value="ongoing" checked={formData.status === 'ongoing'} onChange={handleChange} className="hidden" />
                      <span>✍ Còn tiếp</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${formData.status === 'paused' ? 'bg-text-dim/20 border-text-dim text-text-primary font-semibold' : 'bg-bg-hover border-border-main text-text-secondary hover:border-text-dim'}`}>
                      <input type="radio" name="status" value="paused" checked={formData.status === 'paused'} onChange={handleChange} className="hidden" />
                      <span>⏸ Tạm dừng</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${formData.status === 'full' ? 'bg-jade/10 border-jade text-jade font-semibold shadow-[0_0_10px_rgba(0,200,83,0.2)]' : 'bg-bg-hover border-border-main text-text-secondary hover:border-text-dim'}`}>
                      <input type="radio" name="status" value="full" checked={formData.status === 'full'} onChange={handleChange} className="hidden" />
                      <span className="flex items-center gap-1.5"><Check size={14} /> Hoàn thành</span>
                    </label>
                  </div>
                </div>

              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-main flex justify-end gap-3 bg-bg-hover/50 rounded-b-xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="submit"
            form="editBookForm"
            disabled={submitting || loading || !formConfig}
            className="px-6 py-2 bg-gold text-bg-primary font-bold text-sm rounded-lg hover:bg-gold/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(201,169,110,0.3)] hover:shadow-[0_0_20px_rgba(201,169,110,0.5)] flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-bg-primary border-t-transparent rounded-full animate-spin"></div>
                Đang lưu...
              </>
            ) : (
              'Lưu Thay Đổi'
            )}
          </button>
        </div>
      </div>
    </div>

    {cropImageSrc && (
      <CoverCropperModal
        imageSrc={cropImageSrc}
        onClose={() => {
          URL.revokeObjectURL(cropImageSrc);
          setCropImageSrc(null);
        }}
        onCropComplete={handleCropComplete}
      />
    )}
    </>
  );
}
