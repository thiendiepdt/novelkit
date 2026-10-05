import type { InputHTMLAttributes } from 'react';
import { AlertTriangle, Ban, Check, ImagePlus, Plus, RotateCw, Scissors, Sparkles, Trash2 } from 'lucide-react';
import { Select } from '@/shared/components';
import { useSettingsModal } from '@/features/settings/context/SettingsModalContext';
import { useCreateBook } from '../hooks/useCreateBook';
import type { CreateBookResult } from '../hooks/useCreateBook';
import { toTitleCase } from '../utils/titleCase';
import { SOURCE_NAMES } from '../sources';
import type { BookType, OptionItem } from '../types';
import { CoverCropperModal } from './CoverCropperModal';

interface CreateBookModalProps {
  onClose: () => void;
  /** Called once the story exists on TTC (even if its cover upload failed). */
  onSuccess: (result: CreateBookResult) => void;
}

const INPUT_CLASS =
  'w-full px-3 py-2 bg-bg-hover border border-border-main rounded-lg text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-gold/50';
const LABEL_CLASS = 'text-xs text-text-dim font-medium uppercase tracking-wider block';

const TYPE_OPTIONS: { value: BookType; label: string }[] = [
  { value: 'truyen-cv', label: 'Truyện Convert' },
  { value: 'truyen-dich', label: 'Truyện Dịch' },
  { value: 'sang-tac', label: 'Truyện Sáng Tác' },
];

/** Text input with TTC's "Aa" button: capitalize the first letter of every word. */
function TitleCaseInput({
  value,
  onValueChange,
  readOnly,
  ...rest
}: { value: string; onValueChange: (value: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const canConvert = !readOnly && toTitleCase(value) !== value;
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        readOnly={readOnly}
        className={`${INPUT_CLASS} pr-12 ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
        {...rest}
      />
      <button
        type="button"
        disabled={!canConvert}
        onClick={() => onValueChange(toTitleCase(value))}
        title="Viết hoa chữ cái đầu mỗi từ"
        aria-label="Viết hoa chữ cái đầu mỗi từ"
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-6 rounded text-xs font-bold transition-colors ${
          canConvert ? 'bg-gold text-bg-primary cursor-pointer hover:bg-gold/90' : 'bg-bg-card text-text-dim cursor-default'
        }`}
      >
        Aa
      </button>
    </div>
  );
}

/**
 * One-click choice between a few options: a single bordered track with the active
 * option filled, so the current value stands out and no dropdown has to be opened.
 */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  /** Accessible name of the group (the visible label sits next to it). */
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 p-1 bg-bg-hover border border-border-main rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
            value === opt.value
              ? 'bg-gold text-bg-primary font-semibold shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function OptionSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: OptionItem[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className={LABEL_CLASS}>
        {label} {required && <span className="text-crimson">*</span>}
      </label>
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={required} fullWidth className="text-sm">
        <option value="" disabled={required}>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * TTC's "Đăng Truyện Mới" form, with an AI fill that only needs the source link
 * (see `sources/` for the supported sites): the rest is read from the source and translated.
 */
export function CreateBookModal({ onClose, onSuccess }: CreateBookModalProps) {
  const book = useCreateBook();
  const { openSettings } = useSettingsModal();
  const { form, data, result } = book;

  const isOriginal = data.type === 'sang-tac';
  const aiRunning = book.aiStep !== null;
  const busy = book.submitting || aiRunning;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await book.submit();
    // With a failed cover upload the modal stays open to say so; otherwise we are done.
    if (created && !created.coverError) onSuccess(created);
  };

  const handleRetryCover = async () => {
    const done = await book.retryCoverUpload();
    if (done) onSuccess(done);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" style={{ animation: 'overlayIn 0.2s ease-out' }}>
        <div
          className="bg-bg-card border border-border-main rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
          style={{ animation: 'slideUp 0.3s ease-out' }}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border-main flex justify-between items-center flex-shrink-0 bg-bg-hover/30 rounded-t-xl">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Plus size={18} className="text-gold" /> Đăng Truyện Mới
            </h2>
            <button
              onClick={result ? () => onSuccess(result) : onClose}
              disabled={book.submitting || book.retryingCover}
              aria-label="Đóng"
              className="text-text-dim hover:text-crimson transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-bg-hover disabled:opacity-50 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 relative min-h-[300px]">
            {book.loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-card/90 z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-border-main border-t-gold rounded-full animate-spin"></div>
                  <span className="text-sm text-text-secondary">Đang tải form đăng truyện...</span>
                </div>
              </div>
            )}

            {book.loadError && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="text-crimson text-sm bg-crimson/10 px-4 py-2 rounded-lg border border-crimson/30">{book.loadError}</div>
              </div>
            )}

            {/* Created, but the cover did not make it */}
            {result && (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div className="flex items-center gap-2 text-jade font-semibold">
                  <Check size={18} /> Đã đăng truyện “{result.title}”
                </div>
                <div className="max-w-xl p-3 bg-crimson/10 border border-crimson/30 rounded-lg text-sm text-crimson break-words">
                  Chưa tải được ảnh bìa: {result.coverError}
                </div>
                {book.canRetryCoverUpload ? (
                  <>
                    <p className="text-sm text-text-secondary max-w-xl">
                      Truyện đã có trên TTC, chỉ riêng ảnh bìa chưa lên. Thử lại sẽ gửi lại đúng ảnh bìa này, không
                      tạo truyện lần nữa.
                    </p>
                    <button
                      type="button"
                      onClick={handleRetryCover}
                      disabled={book.retryingCover}
                      className="px-5 py-2 bg-gold text-bg-primary font-bold text-sm rounded-lg hover:bg-gold/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {book.retryingCover ? (
                        <div className="w-4 h-4 border-2 border-bg-primary border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <RotateCw size={14} />
                      )}
                      {book.retryingCover ? 'Đang tải ảnh bìa...' : 'Thử lại tải ảnh bìa'}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-text-secondary max-w-xl">
                    Truyện đã có trên TTC. Bạn có thể đổi ảnh bìa trong mục Sửa của truyện ở danh sách.
                  </p>
                )}
              </div>
            )}

            {form && !result && (
              <form id="createBookForm" onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Loại truyện: first, because it decides whether the AI fill applies and how it
                    translates the title (Hán-Việt for a convert, plain Vietnamese for a translation). */}
                <div className="space-y-2">
                  <label className={LABEL_CLASS}>Loại truyện</label>
                  <Segmented label="Loại truyện" value={data.type} onChange={book.setType} options={TYPE_OPTIONS} />
                </div>

                {/* AI fill */}
                {!isOriginal && (
                  <div className="p-4 rounded-lg border border-purple/30 bg-purple/5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-purple">
                      <Sparkles size={16} /> AI điền từ link truyện gốc
                    </div>
                    <p className="text-xs text-text-secondary">
                      Dán link truyện hoặc link chương từ {SOURCE_NAMES} rồi bấm <strong>AI điền</strong>. Link sangtacviet cũng dùng được, app tự lần về trang gốc. Tên gốc, tác giả gốc và
                      ảnh bìa lấy thẳng từ trang gốc; AI dịch tên truyện, tác giả, văn án và chọn thể loại.{' '}
                      {data.type === 'truyen-dich'
                        ? 'Đang chọn Truyện Dịch: tên truyện được dịch thuần Việt, hạn chế Hán-Việt.'
                        : 'Đang chọn Truyện Convert: tên truyện ưu tiên phiên âm Hán-Việt.'}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        value={data.chinese_link}
                        onChange={(e) => book.setField('chinese_link', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            book.runAiFill();
                          }
                        }}
                        placeholder="https://www.qidian.com/book/... · https://fanqienovel.com/page/... · https://www.qimao.com/shuku/..."
                        aria-label="Link truyện gốc"
                        disabled={busy}
                        className={`${INPUT_CLASS} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={book.runAiFill}
                        disabled={busy || !data.chinese_link.trim()}
                        className="px-4 py-2 bg-purple/20 text-purple border border-purple/40 text-sm font-bold rounded-lg hover:bg-purple/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        {aiRunning ? (
                          <div className="w-4 h-4 border-2 border-purple border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Sparkles size={14} />
                        )}
                        AI điền
                      </button>
                    </div>
                    {book.aiStep && <div className="text-xs text-purple animate-pulse">{book.aiStep}</div>}
                    {!book.aiConfigured && (
                      <div className="text-xs text-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1">
                        <AlertTriangle size={12} className="text-gold" />
                        Chưa cấu hình API key cho AI (Gemini hoặc OpenAI compatible).
                        <button
                          type="button"
                          onClick={() => openSettings(undefined, undefined, 'ai')}
                          className="text-gold hover:underline font-semibold cursor-pointer"
                        >
                          Mở cài đặt AI
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {/* Tên truyện */}
                  <div className="space-y-2 md:col-span-2">
                    <label className={LABEL_CLASS}>
                      Tên truyện <span className="text-crimson">*</span>
                    </label>
                    <TitleCaseInput
                      name="title"
                      value={data.title}
                      onValueChange={(v) => book.setField('title', v)}
                      placeholder="Tên tiếng Việt"
                      required
                    />
                  </div>

                  {/* Giới tính / Độ dài */}
                  <div className="space-y-2">
                    <label className={LABEL_CLASS}>Giới tính</label>
                    <Segmented
                      label="Giới tính"
                      value={data.gender}
                      onChange={(v) => book.setField('gender', v)}
                      options={[
                        { value: 'Nam', label: 'Truyện Nam' },
                        { value: 'Nữ', label: 'Truyện Nữ' },
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={LABEL_CLASS}>Độ dài</label>
                    <Segmented
                      label="Độ dài"
                      value={data.story_length}
                      onChange={(v) => book.setField('story_length', v)}
                      options={[
                        { value: 'Truyện dài', label: 'Truyện dài' },
                        { value: 'Truyện ngắn', label: 'Truyện ngắn' },
                      ]}
                    />
                  </div>

                  {/* Nguồn tiếng Trung */}
                  {!isOriginal && (
                    <>
                      <div className="space-y-2">
                        <label className={LABEL_CLASS}>
                          Tên tiếng Trung <span className="text-crimson">*</span>
                        </label>
                        <input
                          type="text"
                          name="chinese_title"
                          value={data.chinese_title}
                          onChange={(e) => book.setField('chinese_title', e.target.value)}
                          placeholder="Tên tiếng Trung"
                          required
                          className={`${INPUT_CLASS} ${book.copyright.blocked ? 'border-crimson' : ''}`}
                        />
                        {book.copyright.blocked && (
                          <div className="text-xs text-crimson flex items-center gap-1.5">
                            <Ban size={12} /> Tên bản quyền bị chặn{book.copyright.note ? ` — ${book.copyright.note}` : ''}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className={LABEL_CLASS}>
                          Link tiếng Trung <span className="text-crimson">*</span>
                        </label>
                        <input
                          type="url"
                          name="chinese_link"
                          value={data.chinese_link}
                          onChange={(e) => book.setField('chinese_link', e.target.value)}
                          placeholder="Link tiếng Trung"
                          required
                          className={INPUT_CLASS}
                        />
                      </div>
                    </>
                  )}

                  {/* Tác giả */}
                  <div className={`space-y-2 ${isOriginal ? 'md:col-span-2' : ''}`}>
                    <label className={LABEL_CLASS}>
                      Tên tác giả hiển thị <span className="text-crimson">*</span>
                    </label>
                    <TitleCaseInput
                      name="author"
                      value={data.author}
                      onValueChange={(v) => book.setField('author', v)}
                      readOnly={isOriginal}
                      required
                    />
                  </div>
                  {!isOriginal && (
                    <div className="space-y-2">
                      <label className={LABEL_CLASS}>
                        Tên gốc tác giả <span className="text-crimson">*</span>
                      </label>
                      <TitleCaseInput
                        name="author_original"
                        value={data.author_original}
                        onValueChange={(v) => book.setField('author_original', v)}
                        placeholder="Tên gốc tác giả"
                        required
                      />
                    </div>
                  )}

                  {/* Phân loại: all four are mandatory on TTC, although its own form marks only Thể loại. */}
                  <OptionSelect
                    label="Thể loại"
                    placeholder="Vui lòng chọn thể loại"
                    value={data.category}
                    options={form.options.categories}
                    onChange={(v) => book.setField('category', v)}
                    required
                  />
                  <OptionSelect
                    label="Tính cách"
                    placeholder="Vui lòng chọn tính cách"
                    value={data.sub_categories[0]}
                    options={form.options.subCategoriesTichCach}
                    onChange={(v) => book.setSubCategory(0, v)}
                    required
                  />
                  <OptionSelect
                    label="Bối cảnh"
                    placeholder="Vui lòng chọn bối cảnh"
                    value={data.sub_categories[1]}
                    options={form.options.subCategoriesBoiCanh}
                    onChange={(v) => book.setSubCategory(1, v)}
                    required
                  />
                  <OptionSelect
                    label="Lưu phái"
                    placeholder="Vui lòng chọn lưu phái"
                    value={data.sub_categories[2]}
                    options={form.options.subCategoriesLuuPhai}
                    onChange={(v) => book.setSubCategory(2, v)}
                    required
                  />

                  {/* Giới thiệu */}
                  <div className="space-y-2 md:col-span-2">
                    <label className={LABEL_CLASS}>Giới thiệu</label>
                    <textarea
                      name="description"
                      value={data.description}
                      onChange={(e) => book.setField('description', e.target.value)}
                      rows={8}
                      placeholder="Giới thiệu truyện..."
                      className={`${INPUT_CLASS} py-3 resize-y`}
                    />
                  </div>

                  {/* Ảnh bìa */}
                  <div className="md:col-span-2 p-4 bg-bg-hover/50 rounded-lg border border-border-main flex flex-col sm:flex-row gap-4">
                    <div className="w-24 h-32 flex-shrink-0 rounded-lg border border-border-main bg-bg-primary overflow-hidden flex items-center justify-center text-text-dim">
                      {book.loadingCover ? (
                        <div className="w-5 h-5 border-2 border-border-main border-t-gold rounded-full animate-spin"></div>
                      ) : book.cover ? (
                        <img src={book.cover.previewUrl} alt="Ảnh bìa" className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus size={24} />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 justify-center">
                      <span className={LABEL_CLASS}>Ảnh bìa</span>
                      <p className="text-xs text-text-secondary">
                        TTC yêu cầu truyện mới có ảnh bìa. Ảnh được tải lên ngay sau khi truyện được tạo.
                        {!isOriginal && ' AI điền sẽ tự lấy ảnh bìa từ trang gốc.'}
                      </p>
                      {book.loadingCover && (
                        <div className="text-xs text-gold flex flex-wrap items-center gap-x-2">
                          <span className="animate-pulse">Đang tải ảnh bìa từ trang gốc...</span>
                          <button
                            type="button"
                            onClick={book.skipSourceCover}
                            className="text-text-secondary hover:text-text-primary underline cursor-pointer"
                          >
                            Bỏ qua
                          </button>
                        </div>
                      )}
                      {book.coverError && !book.loadingCover && (
                        <div className="text-xs text-crimson break-words">{book.coverError}</div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={book.pickCoverFile}
                          disabled={busy}
                          className="px-3 py-1.5 bg-purple/10 text-purple border border-purple/20 text-xs font-bold rounded-lg hover:bg-purple/20 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        >
                          <ImagePlus size={12} /> {book.cover ? 'Chọn ảnh khác' : 'Chọn ảnh từ máy'}
                        </button>
                        {book.coverError && book.canRetrySourceCover && !book.loadingCover && (
                          <button
                            type="button"
                            onClick={book.retrySourceCover}
                            disabled={busy}
                            className="px-3 py-1.5 bg-gold/10 text-gold border border-gold/30 text-xs font-bold rounded-lg hover:bg-gold/20 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                          >
                            <RotateCw size={12} /> Tải lại ảnh bìa gốc
                          </button>
                        )}
                        {book.cover && (
                          <>
                            <button
                              type="button"
                              onClick={book.recropCover}
                              disabled={busy}
                              className="px-3 py-1.5 bg-bg-card text-text-secondary border border-border-main text-xs font-bold rounded-lg hover:text-text-primary hover:border-text-dim transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                            >
                              <Scissors size={12} /> Cắt ảnh
                            </button>
                            <button
                              type="button"
                              onClick={book.removeCover}
                              disabled={busy}
                              className="px-3 py-1.5 bg-bg-card text-text-secondary border border-border-main text-xs font-bold rounded-lg hover:text-crimson hover:border-crimson/40 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                            >
                              <Trash2 size={12} /> Bỏ ảnh
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quy định */}
                  {form.rules.length > 0 && (
                    <details className="md:col-span-2 rounded-lg border border-border-main bg-bg-primary">
                      <summary className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gold cursor-pointer select-none">
                        Quy định khi đăng truyện
                      </summary>
                      <ol className="list-decimal pl-9 pr-4 pb-3 space-y-1.5 text-xs text-text-secondary">
                        {form.rules.map((rule, i) => (
                          <li key={i}>{rule}</li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Status: pinned between the scrolling form and the footer. The form is taller than
              the dialog and both actions that can fail ("AI điền" at the top, "Đăng Truyện" in
              the footer) are far apart, so a message inside the scroll area would be off-screen
              for one of them. */}
          {!result && (book.error || book.notice) && (
            <div className="px-5 py-3 border-t border-border-main flex-shrink-0 flex flex-col gap-2 max-h-40 overflow-auto">
              {book.error && (
                <div role="alert" className="p-3 bg-crimson/10 border border-crimson/30 rounded-lg text-sm text-crimson break-words">
                  {book.error}
                </div>
              )}
              {book.notice && (
                <div className="p-3 bg-jade/10 border border-jade/30 rounded-lg text-sm text-jade break-words">{book.notice}</div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border-main flex justify-end gap-3 bg-bg-hover/50 rounded-b-xl flex-shrink-0">
            {result ? (
              <button
                type="button"
                onClick={() => onSuccess(result)}
                disabled={book.retryingCover}
                className="px-6 py-2 bg-bg-hover text-text-primary border border-border-main font-bold text-sm rounded-lg hover:border-text-dim transition-all cursor-pointer disabled:opacity-50"
              >
                Đóng
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                  disabled={book.submitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  form="createBookForm"
                  // While the cover is still downloading, submitting would create the story without it.
                  disabled={busy || book.loading || book.loadingCover || !form || book.copyright.blocked}
                  className="px-6 py-2 bg-gold text-bg-primary font-bold text-sm rounded-lg hover:bg-gold/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {book.submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-bg-primary border-t-transparent rounded-full animate-spin"></div>
                      Đang đăng...
                    </>
                  ) : (
                    'Đăng Truyện'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {book.cropSrc && (
        <CoverCropperModal imageSrc={book.cropSrc} onClose={book.closeCropper} onCropComplete={book.handleCropComplete} />
      )}
    </>
  );
}
