import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Cat, CheckCircle2, ExternalLink, Loader2, Search, Sparkles, X } from 'lucide-react';
import { useSettingsModal } from '@/features/settings/context/SettingsModalContext';
import { openExternal } from '@/shared/utils/openExternal';
import type { TtcStory } from '../types';
import { useMeoTruyenUpload } from '../meotruyen/useMeoTruyenUpload';
import { BOOK_TEXT_MAX, charCount } from '../meotruyen/rules';
import { MEOTRUYEN_ORIGIN, type MeoGenre, type MeoLink } from '../meotruyen/types';
import { SOURCE_LABELS } from '../sources';

interface MeoTruyenModalProps {
  book: TtcStory;
  /** The Mèo Truyện book this story was imported as, if it was. */
  link?: MeoLink;
  onImported: (link: MeoLink) => void;
  onClose: () => void;
}

const STATUS_LABELS = { ongoing: 'Đang ra', completed: 'Hoàn thành', paused: 'Tạm dừng' } as const;
const CHIP = 'px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1';
const CHIP_ON = 'bg-gold/15 border-gold/50 text-gold font-semibold';
const CHIP_OFF = 'bg-bg-hover border-border-main text-text-secondary hover:border-border-hover hover:text-text-primary';
/** Problems shown before the rest are summed up. */
const SHOWN_PROBLEMS = 8;

const adminUrl = (bookId: number) => `${MEOTRUYEN_ORIGIN}/admin/truyen/${bookId}`;
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').toLowerCase();

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-text-dim">{label}</div>
      <div className="text-sm text-text-primary break-words">{children}</div>
    </div>
  );
}

/** Tags already picked, and a search to add more (the site has a few hundred). */
function TagPicker({ tags, picked, onToggle, disabled }: { tags: MeoGenre[]; picked: string[]; onToggle: (slug: string) => void; disabled: boolean }) {
  const [query, setQuery] = useState('');
  const chosen = tags.filter((t) => picked.includes(t.slug));
  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return tags.filter((t) => !picked.includes(t.slug) && fold(t.name).includes(q)).slice(0, 18);
  }, [query, tags, picked]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {chosen.length === 0 && <span className="text-xs text-text-dim">Chưa chọn chủ đề nào.</span>}
        {chosen.map((t) => (
          <button
            key={t.slug}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(t.slug)}
            aria-label={`Bỏ chủ đề ${t.name}`}
            className={`${CHIP} ${CHIP_ON} disabled:cursor-default`}
          >
            {t.name} <X size={12} />
          </button>
        ))}
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm chủ đề để thêm (ngọt, trùng sinh, cung đấu...)"
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-bg-primary border border-border-main rounded-lg text-text-primary placeholder:text-text-dim focus:outline-none focus:border-gold/50"
        />
      </div>
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((t) => (
            <button key={t.slug} type="button" onClick={() => onToggle(t.slug)} className={`${CHIP} ${CHIP_OFF}`}>
              + {t.name}
            </button>
          ))}
        </div>
      )}
      {query.trim() !== '' && matches.length === 0 && <span className="text-xs text-text-dim">Không có chủ đề nào khớp.</span>}
    </div>
  );
}

/**
 * "Đăng lên Mèo Truyện": a female story of TTC with the chapters of its folder, sent to
 * meotruyen.com through the import API (a draft there, published from its edit page).
 */
export function MeoTruyenModal({ book, link, onImported, onClose }: MeoTruyenModalProps) {
  const meo = useMeoTruyenUpload(book, link, onImported);
  const { openSettings } = useSettingsModal();
  const sending = meo.phase === 'sending';
  const busy = sending || meo.aiState.running || meo.phase === 'done';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  // The duplicates, the progress and the outcome sit under the form: bring them into view.
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (meo.phase !== 'ready' || meo.sendError) statusRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [meo.phase, meo.sendError]);

  const known = meo.genres.state === 'ok' ? meo.genres.value : [];
  const genreList = known.filter((g) => g.kind === 'genre');
  const tagList = known.filter((g) => g.kind === 'tag');
  const open = meo.build?.open;
  const problems = meo.build?.problems ?? [];
  const noteLength = charCount(meo.picks.editorNote.trim());
  const loadErrors = [meo.genres, meo.chapters].flatMap((l) => (l.state === 'error' ? [l.message] : []));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" style={{ animation: 'overlayIn 0.2s ease-out' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="meo-title"
        className="bg-bg-card border border-border-main rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="px-5 py-4 border-b border-border-main flex items-center gap-3 bg-bg-hover/30 rounded-t-xl">
          <Cat size={20} className="text-gold flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 id="meo-title" className="text-lg font-bold text-text-primary">
              {link ? 'Cập nhật lên Mèo Truyện' : 'Đăng lên Mèo Truyện'}
            </h2>
            <p className="text-xs text-text-dim truncate">{book.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-text-dim hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4 text-sm">
          {meo.tokenSource === 'none' && (
            <div role="alert" className="p-3 bg-crimson/10 border border-crimson/30 rounded-lg text-crimson flex flex-wrap items-center gap-2">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span className="flex-1 min-w-60">
                Chưa có token Mèo Truyện. Tạo token ở trang "Token nạp truyện" của khu quản trị Mèo Truyện, rồi nhập vào Cài đặt
                (hoặc đặt biến môi trường MEOTRUYEN_TOKEN).
              </span>
              <button
                type="button"
                onClick={() => openSettings(undefined, undefined, 'meoTruyen')}
                className="text-xs font-bold bg-crimson text-white px-3 py-1.5 rounded-lg hover:bg-crimson/90 cursor-pointer whitespace-nowrap"
              >
                Mở cài đặt
              </button>
            </div>
          )}

          {link && meo.phase !== 'done' && (
            <div className="p-3 bg-bg-hover/50 border border-border-main rounded-lg text-xs text-text-secondary flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Đã nạp lên Mèo Truyện ({link.chapters} chương, ngày {new Date(link.at).toLocaleDateString('vi-VN')}). Gửi lần nữa sẽ cập nhật
                đúng truyện đó: chương trùng số được thay, chương mới được thêm.
              </span>
              <button
                type="button"
                onClick={() => void openExternal(adminUrl(link.bookId))}
                className="inline-flex items-center gap-1 text-gold hover:underline cursor-pointer"
              >
                Trang sửa truyện <ExternalLink size={12} />
              </button>
            </div>
          )}

          {/* Story as it will appear: from TTC, not editable here */}
          <div className="flex gap-4">
            <div className="w-24 h-32 flex-shrink-0 rounded-lg overflow-hidden border border-border-main bg-bg-hover flex items-center justify-center">
              {meo.cover.state === 'loading' && <Loader2 size={18} className="text-text-dim motion-safe:animate-spin" />}
              {meo.cover.state === 'ok' && meo.cover.value && (
                <img src={meo.cover.value.previewUrl} alt="Ảnh bìa" className="w-full h-full object-cover" />
              )}
              {(meo.cover.state === 'error' || (meo.cover.state === 'ok' && !meo.cover.value)) && (
                <span className="text-[11px] text-text-dim text-center px-1">Không có bìa</span>
              )}
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <Field label="Tên truyện">{book.title}</Field>
              <Field label="Tên tiếng Trung">{book.chinese_title || <span className="text-crimson">Chưa có</span>}</Field>
              <Field label="Tác giả">
                {book.author}
                {book.author_original ? <span className="text-text-dim"> · {book.author_original}</span> : null}
              </Field>
              <Field label="Trạng thái">{open ? STATUS_LABELS[open.status] : '...'}</Field>
              <Field label="Chương (từ folder)">
                {meo.chapters.state === 'loading' ? (
                  <span className="text-text-dim">Đang đọc folder...</span>
                ) : meo.build ? (
                  <span className="tabular-nums">
                    {meo.build.texts.length} chương · {meo.build.wordCount.toLocaleString('vi-VN')} chữ
                    <span className="text-text-dim"> (TTC: {book.total_chapters})</span>
                  </span>
                ) : (
                  <span className="text-text-dim">—</span>
                )}
              </Field>
              <Field label="Mã truyện trong app">{book.id}</Field>
            </div>
          </div>
          {meo.cover.state === 'error' && <p className="text-xs text-gold">{meo.cover.message} Truyện vẫn nạp được, không kèm bìa.</p>}

          {book.description && (
            <details className="group">
              <summary className="text-xs text-text-dim cursor-pointer hover:text-text-secondary">Giới thiệu (lấy nguyên văn án trên TTC)</summary>
              <p className="mt-2 text-xs text-text-secondary whitespace-pre-line max-h-40 overflow-y-auto pr-1">{book.description}</p>
            </details>
          )}

          {/* AI picks */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {meo.aiState.running ? (
              <span className="inline-flex items-center gap-1.5 text-gold">
                <Loader2 size={13} className="motion-safe:animate-spin" /> AI đang chọn thể loại, chủ đề và viết lời giới thiệu...
              </span>
            ) : meo.aiReady ? (
              <button
                type="button"
                onClick={meo.rerunAi}
                disabled={busy || meo.genres.state !== 'ok'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
              >
                <Sparkles size={13} /> AI chọn lại
              </button>
            ) : (
              <span className="text-text-dim">
                Chưa cấu hình AI nên phải chọn tay.{' '}
                <button type="button" onClick={() => openSettings(undefined, undefined, 'ai')} className="text-gold hover:underline cursor-pointer">
                  Mở cài đặt AI
                </button>
              </span>
            )}
            {meo.aiState.error && <span className="text-crimson break-words">AI lỗi: {meo.aiState.error}</span>}
          </div>

          {/* The source's own labels: the model's main clue, and exact matches picked already */}
          {meo.source.state === 'loading' && (
            <p className="text-xs text-text-dim inline-flex items-center gap-1.5">
              <Loader2 size={12} className="motion-safe:animate-spin" /> Đang đọc nhãn gốc ở trang nguồn...
            </p>
          )}
          {meo.source.state === 'error' && (
            <p className="text-xs text-text-dim break-words">
              Không đọc được trang nguồn ({meo.source.message}): AI chọn chủ đề từ văn án và phân loại TTC.
            </p>
          )}
          {meo.sourceInfo && meo.sourceInfo.terms.length > 0 && (
            <div className="text-xs text-text-secondary flex flex-wrap items-center gap-1.5">
              <span className="text-text-dim">Nhãn gốc ({SOURCE_LABELS[meo.sourceInfo.book.source].split(' (')[0]}):</span>
              {meo.sourceInfo.terms.map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04]">
                  {t}
                </span>
              ))}
              {meo.sourceInfo.matched.length > 0 && (
                <span className="text-jade">· {meo.sourceInfo.matched.length} chủ đề khớp đúng tên gốc được chọn sẵn</span>
              )}
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-text-secondary">
              Thể loại <span className="text-crimson">*</span>
            </h3>
            {meo.genres.state === 'loading' ? (
              <span className="text-xs text-text-dim">Đang tải thể loại của Mèo Truyện...</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {genreList.map((g) => {
                  const on = meo.picks.genres.includes(g.slug);
                  return (
                    <button
                      key={g.slug}
                      type="button"
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() => meo.togglePick(g.slug)}
                      className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF} disabled:cursor-default`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {tagList.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-text-secondary">Chủ đề</h3>
              <TagPicker tags={tagList} picked={meo.picks.genres} onToggle={meo.togglePick} disabled={busy} />
            </section>
          )}

          <section className="flex flex-col gap-1.5">
            <label htmlFor="meo-note" className="text-xs font-semibold text-text-secondary">
              Lời giới thiệu của BTV <span className="font-normal text-text-dim">(không bắt buộc)</span>
            </label>
            <textarea
              id="meo-note"
              rows={3}
              value={meo.picks.editorNote}
              disabled={busy}
              onChange={(e) => meo.setEditorNote(e.target.value)}
              placeholder="Một hai câu vì sao truyện đáng đọc"
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-main rounded-lg text-text-primary placeholder:text-text-dim focus:outline-none focus:border-gold/50 resize-y"
            />
            <span className={`text-[11px] self-end tabular-nums ${noteLength > BOOK_TEXT_MAX.editorNote ? 'text-crimson' : 'text-text-dim'}`}>
              {noteLength}/{BOOK_TEXT_MAX.editorNote}
            </span>
          </section>

          {(loadErrors.length > 0 || problems.length > 0) && (
            <div role="alert" className="p-3 bg-crimson/10 border border-crimson/30 rounded-lg text-crimson text-xs flex flex-col gap-1">
              <span className="font-semibold">Chưa gửi được:</span>
              <ul className="list-disc pl-4 flex flex-col gap-0.5">
                {[...loadErrors, ...problems].slice(0, SHOWN_PROBLEMS).map((p) => (
                  <li key={p} className="break-words">
                    {p}
                  </li>
                ))}
              </ul>
              {loadErrors.length + problems.length > SHOWN_PROBLEMS && (
                <span>và {loadErrors.length + problems.length - SHOWN_PROBLEMS} lỗi khác.</span>
              )}
            </div>
          )}
          {meo.build?.warnings.map((w) => (
            <p key={w} className="text-xs text-gold">
              {w}
            </p>
          ))}

          {meo.phase === 'duplicate' && (
            <div className="p-3 bg-gold/10 border border-gold/40 rounded-lg flex flex-col gap-2">
              <span className="text-sm font-semibold text-gold">Mèo Truyện đã có truyện trùng tên tiếng Trung hoặc link nguồn:</span>
              {meo.duplicates.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                  <span className="text-text-primary font-medium">“{d.title}”</span>
                  <span>
                    #{d.id} · {d.isPublished ? 'đang đăng' : 'bản nháp'} · {d.chapterCount} chương · trùng{' '}
                    {d.fields.map((f) => (f === 'titleZh' ? 'tên tiếng Trung' : 'link nguồn')).join(' và ')}
                  </span>
                  {d.chaptersDeleted > 0 && (
                    <span className="text-crimson">
                      ghi đè sẽ xóa {d.chaptersDeleted} chương cuối và {d.commentsDeleted} bình luận của chúng
                    </span>
                  )}
                  <span className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => void openExternal(adminUrl(d.id))}
                      className="inline-flex items-center gap-1 text-gold hover:underline cursor-pointer"
                    >
                      Xem <ExternalLink size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void meo.send(d.id)}
                      className="px-2.5 py-1 rounded-lg bg-gold text-bg-primary font-semibold hover:bg-gold/90 cursor-pointer"
                    >
                      Ghi đè truyện này
                    </button>
                  </span>
                </div>
              ))}
              <span className="text-[11px] text-text-dim">
                Ghi đè giữ đường dẫn, trạng thái đăng và bình luận của các chương còn lại; thay thông tin, thể loại, bìa và nội dung chương.
              </span>
              <button type="button" onClick={meo.backFromDuplicate} className="self-start text-xs text-text-secondary hover:text-text-primary cursor-pointer">
                ← Không ghi đè, quay lại
              </button>
            </div>
          )}

          {meo.progress && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-text-secondary">
                {meo.progress.step === 'open'
                  ? 'Đang mở phiên nạp...'
                  : meo.progress.step === 'send'
                    ? `Đã gửi ${meo.progress.sent}/${meo.progress.total} chương`
                    : 'Đang chốt phiên nạp...'}
              </span>
              <div
                role="progressbar"
                aria-label="Tiến độ nạp"
                aria-valuemin={0}
                aria-valuemax={meo.progress.total}
                aria-valuenow={meo.progress.sent}
                className="h-1.5 rounded-full bg-white/10 overflow-hidden"
              >
                <div
                  className="h-full bg-gold rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${meo.progress.total ? (meo.progress.sent / meo.progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {meo.sendError && (
            <div role="alert" className="p-3 bg-crimson/10 border border-crimson/30 rounded-lg text-crimson text-xs break-words">
              {meo.sendError}
            </div>
          )}

          {meo.phase === 'done' && meo.result && (
            <div className="p-3 bg-jade/10 border border-jade/30 rounded-lg text-jade flex flex-wrap items-center gap-2">
              <CheckCircle2 size={16} className="flex-shrink-0" />
              <span className="flex-1 min-w-60">
                {meo.result.overwrote
                  ? 'Đã cập nhật truyện trên Mèo Truyện; truyện giữ trạng thái đăng như trước.'
                  : 'Đã nạp thành bản nháp. Mở trang sửa truyện trên Mèo Truyện để đăng.'}
              </span>
              {meo.result.book ? (
                <button
                  type="button"
                  onClick={() => void openExternal(adminUrl(meo.result!.book!.id))}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-jade text-bg-primary hover:bg-jade/90 cursor-pointer"
                >
                  Mở trang sửa <ExternalLink size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void openExternal(`${MEOTRUYEN_ORIGIN}/admin/truyen`)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-jade hover:underline cursor-pointer"
                >
                  Danh sách truyện <ExternalLink size={12} />
                </button>
              )}
            </div>
          )}
          {/* Bottom of the status blocks above */}
          <div ref={statusRef} />
        </div>

        <div className="px-5 py-4 border-t border-border-main flex items-center justify-end gap-3 bg-bg-hover/50 rounded-b-xl">
          {meo.tokenSource === 'env' && <span className="mr-auto text-[11px] text-text-dim">Dùng token từ biến môi trường MEOTRUYEN_TOKEN</span>}
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            {meo.phase === 'done' ? 'Xong' : 'Đóng'}
          </button>
          {meo.phase !== 'done' && (
            <button
              type="button"
              onClick={() => void meo.send()}
              disabled={!meo.canSend}
              className="px-5 py-2 bg-gold text-bg-primary font-bold text-sm rounded-lg hover:bg-gold/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sending ? <Loader2 size={14} className="motion-safe:animate-spin" /> : <Cat size={14} />}
              {sending ? 'Đang gửi...' : link ? 'Cập nhật lên Mèo Truyện' : 'Nạp thành bản nháp'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
