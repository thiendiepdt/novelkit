import { useState, useCallback, useRef } from 'react';
import { formatText, type FormatResult } from './utils/formatter';
import { copyToClipboard } from '@/shared/utils/clipboard';
import StatsPanel from './components/StatsPanel';
import ChineseWarning from './components/ChineseWarning';
import FullscreenPreview from '@/shared/components/FullscreenPreview';
import { FileText, Maximize2, DownloadCloud, Clipboard, Sparkles, Check, UploadCloud } from 'lucide-react';

export default function TextFormatterPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<FormatResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  const handleFormat = useCallback(() => {
    if (!input.trim()) return;
    const formatted = formatText(input);
    setResult(formatted);
    setCopied(false);
  }, [input]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const ok = await copyToClipboard(result.text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setInput('');
    setResult(null);
    setCopied(false);
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch {
      // Clipboard read failed — user can paste manually
    }
  }, []);

  return (
    <div className="w-full mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Title */}
      <div className="mb-6" style={{ animation: 'fadeIn 0.4s ease-out' }}>
        <h1 className="text-xl md:text-2xl font-bold text-gold flex items-center gap-2">
          <FileText size={28} className="text-gold" />
          Format Truyện
        </h1>
        <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">
          Paste nội dung vào → Format → Copy kết quả. Tự động tách đoạn, xóa indent, kiểm tra chữ Trung.
        </p>
      </div>

      {/* Input Section */}
      <div className="mb-4" style={{ animation: 'fadeIn 0.4s ease-out 0.1s both' }}>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="input-text" className="text-sm font-medium text-text-secondary">
            <DownloadCloud size={14} className="inline mr-1 -mt-0.5" /> Nội dung gốc
          </label>
          <div className="flex items-center gap-2">
            {input && (
              <button
                onClick={handleClear}
                className="text-xs font-medium text-crimson bg-crimson/10 border border-crimson/25 hover:bg-crimson/20 transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95"
              >
                ✕ Xóa
              </button>
            )}
            <button
              onClick={handlePaste}
              className="text-xs font-medium text-gold bg-gold-glow/50 border border-border-gold hover:bg-gold-glow transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95"
            >
              <Clipboard size={12} className="inline mr-1" /> Dán
            </button>
          </div>
        </div>
        <textarea
          id="input-text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste nội dung truyện vào đây..."
          className="w-full bg-bg-card border border-border-main rounded-xl p-4 text-sm leading-relaxed text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-border-gold focus:ring-1 focus:ring-border-gold/30 transition-all duration-300 resize-none"
          rows={8}
          style={{ minHeight: '160px' }}
        />
      </div>

      {/* Action Buttons */}
      <div
        className="flex items-center gap-3 mb-6"
        style={{ animation: 'fadeIn 0.4s ease-out 0.2s both' }}
      >
        <button
          id="btn-format"
          onClick={handleFormat}
          disabled={!input.trim()}
          className="flex-1 sm:flex-none bg-gold text-bg-primary font-semibold text-sm px-6 py-3 rounded-xl transition-all duration-300 hover:bg-gold-light active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gold"
          style={{
            boxShadow: input.trim() ? '0 4px 20px rgba(201,169,110,0.3)' : 'none',
          }}
        >
          <Sparkles size={14} className="inline mr-1 -mt-0.5" /> Format
        </button>

        {result && (
          <button
            id="btn-copy"
            onClick={handleCopy}
            className={`flex-1 sm:flex-none text-sm font-medium px-6 py-3 rounded-xl border transition-all duration-300 active:scale-[0.97] ${
              copied
                ? 'bg-jade/20 border-jade/40 text-jade'
                : 'bg-bg-card border-border-main text-text-secondary hover:border-border-gold hover:text-gold'
            }`}
          >
            {copied ? <><Check size={14} className="inline mr-1" /> Đã copy!</> : <><Clipboard size={14} className="inline mr-1" /> Copy kết quả</>}
          </button>
        )}
      </div>

      {/* Results */}
      {result && (
        <div style={{ animation: 'slideUp 0.4s ease-out' }}>
          {/* Stats */}
          <StatsPanel result={result} />

          {/* Chinese Warning */}
          {result.hasChinese && (
            <ChineseWarning chineseChars={result.chineseChars} />
          )}

          {/* Output */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="output-text" className="text-sm font-medium text-text-secondary">
                <UploadCloud size={14} className="inline mr-1 -mt-0.5" /> Kết quả đã format
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFullscreen(true)}
                  className="text-xs font-medium text-text-primary bg-bg-card border border-border-main hover:border-border-gold hover:text-gold transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95 flex items-center gap-1"
                >
                  <Maximize2 size={14} /> Xem toàn màn
                </button>
                <button
                  onClick={handleCopy}
                  className="text-xs font-medium text-gold bg-gold-glow/50 border border-border-gold hover:bg-gold-glow transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95"
                >
                  {copied ? <><Check size={12} className="inline mr-1" /> Copied</> : <><Clipboard size={12} className="inline mr-1" /> Copy</>}
                </button>
              </div>
            </div>
            <textarea
              id="output-text"
              ref={outputRef}
              readOnly
              value={result.text}
              className="w-full bg-bg-secondary border border-border-main rounded-xl p-4 text-sm leading-relaxed text-text-primary focus:outline-none resize-none"
              rows={10}
              style={{ minHeight: '200px' }}
            />
          </div>

          {/* Fullscreen Preview */}
          <FullscreenPreview
            text={result.text}
            isOpen={showFullscreen}
            onClose={() => setShowFullscreen(false)}
          />
        </div>
      )}
    </div>
  );
}
