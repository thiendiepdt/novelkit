import { useCallback } from 'react';
import { useChapterSplitter } from './hooks/useChapterSplitter';
import { copyToClipboard } from '@/shared/utils/clipboard';
import { downloadAsTextFile, sanitizeFilename } from '@/shared/utils/download';
import FullscreenPreview from '@/shared/components/FullscreenPreview';
import SplitterSettings from './components/SplitterSettings';
import SplitterInput from './components/SplitterInput';
import SplitterStats from './components/SplitterStats';
import PartListView from './components/PartListView';
import PartTabsView from './components/PartTabsView';
import { Scissors, Save, Maximize2, Sparkles, UploadCloud, Check, Clipboard, BookOpen } from 'lucide-react';

export default function ChapterSplitterPage() {
  const splitter = useChapterSplitter();
  const { result, mergedText, copiedIndex, setCopiedIndex } = splitter;

  const handleCopyPart = useCallback(async (text: string, index: number) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, [setCopiedIndex]);

  const handleDownloadOutput = useCallback(() => {
    if (!mergedText) return;
    const filename = result?.chapterCount
      ? `split_${result.chapterCount}_chapters.txt`
      : 'split_output.txt';
    downloadAsTextFile(mergedText, filename);
  }, [mergedText, result]);

  const handleDownloadPart = useCallback((text: string, index: number) => {
    const heading = text.split('\n')[0] || `part_${index + 1}`;
    const filename = sanitizeFilename(heading) || `part_${index + 1}`;
    downloadAsTextFile(text, `${filename}.txt`);
  }, []);

  return (
    <div className="w-full mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Title */}
      <div className="mb-6" style={{ animation: 'fadeIn 0.4s ease-out' }}>
        <h1 className="text-xl md:text-2xl font-bold text-gold flex items-center gap-2">
          <Scissors size={28} className="text-gold" />
          Chia Chương
        </h1>
        <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">
          Paste hoặc upload file .txt chứa nội dung chương. Hỗ trợ <strong className="text-text-primary">chia nhiều chương</strong> cùng lúc
          — tool sẽ tự động nhận diện tiêu đề "Chương X" để chia tách.
        </p>
      </div>

      {/* Settings */}
      <SplitterSettings
        maxWords={splitter.maxWords}
        setMaxWords={splitter.setMaxWords}
        roundUp={splitter.roundUp}
        setRoundUp={splitter.setRoundUp}
        minWords={splitter.minWords}
        setMinWords={splitter.setMinWords}
      />

      {/* Input */}
      <SplitterInput
        input={splitter.input}
        setInput={splitter.setInput}
        isMultiChapter={splitter.isMultiChapter}
        chapterBoundaryCount={splitter.chapterBoundaryCount}
        isLargeInput={splitter.isLargeInput}
        inputStats={splitter.inputStats}
        isValidInput={splitter.isValidInput}
        fileInputRef={splitter.fileInputRef}
        onFileUpload={splitter.handleFileUpload}
        onFileInputChange={splitter.handleFileInputChange}
        onClear={splitter.handleClear}
        onPaste={splitter.handlePaste}
        onShowFullscreen={() => splitter.setShowInputFullscreen(true)}
      />

      {/* Action Button */}
      <div className="flex items-center gap-3 mb-6" style={{ animation: 'fadeIn 0.4s ease-out 0.2s both' }}>
        <button
          onClick={splitter.handleSplit}
          disabled={!splitter.input.trim() || !splitter.isValidInput}
          className="flex-1 sm:flex-none bg-gold text-bg-primary font-semibold text-sm px-6 py-3 rounded-xl transition-all duration-300 hover:bg-gold-light active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gold"
          style={{
            boxShadow: splitter.input.trim() && splitter.isValidInput ? '0 4px 20px rgba(201,169,110,0.3)' : 'none',
          }}
        >
          {splitter.isMultiChapter ? <><Sparkles size={14} className="inline mr-1" /> Chia {splitter.chapterBoundaryCount} Chương</> : <><Sparkles size={14} className="inline mr-1" /> Chia Chương</>}
        </button>
      </div>

      {/* Results */}
      {result && result.parts.length > 0 && (
        <div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <SplitterStats result={result} />

          {/* Output header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-text-secondary">
              <UploadCloud size={14} className="inline mr-1 -mt-0.5" /> Kết quả chia ({result.parts.length} phần):
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyPart(mergedText, -1)}
                className={`text-xs font-medium transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95 flex items-center gap-1 ${
                  copiedIndex === -1
                    ? 'bg-jade/20 border border-jade/40 text-jade'
                    : 'bg-bg-card border border-border-main text-text-secondary hover:border-border-gold hover:text-gold'
                }`}
              >
                {copiedIndex === -1 ? <><Check size={12} className="inline mr-1" /> Copied</> : <><Clipboard size={12} className="inline mr-1" /> Copy tất cả</>}
              </button>
              <button
                onClick={handleDownloadOutput}
                className="text-xs font-medium text-jade bg-jade/10 border border-jade/25 hover:bg-jade/20 transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95 flex items-center gap-1"
              >
                <Save size={14} /> Tải .txt
              </button>
              <button
                onClick={() => splitter.setShowFullscreen(true)}
                className="text-xs font-medium text-text-primary bg-bg-card border border-border-main hover:border-border-gold hover:text-gold transition-all duration-200 px-2.5 py-1.5 rounded-lg active:scale-95 flex items-center gap-1"
              >
                <Maximize2 size={14} /> Xem toàn màn
              </button>
            </div>
          </div>

          {/* Output content */}
          {splitter.isLargeOutput ? (
            <PartListView
              paginatedParts={splitter.paginatedParts}
              copiedIndex={copiedIndex}
              listPage={splitter.listPage}
              totalPages={splitter.totalPages}
              onPageChange={splitter.setListPage}
              onPreview={splitter.setPreviewPartIndex}
              onDownload={handleDownloadPart}
              onCopy={handleCopyPart}
            />
          ) : (
            <PartTabsView
              result={result}
              activeTab={splitter.activeTab}
              setActiveTab={splitter.setActiveTab}
              mergedText={mergedText}
              mergedMarkers={splitter.mergedMarkers}
              showTabs={splitter.showTabs}
              copiedIndex={copiedIndex}
              onCopy={handleCopyPart}
            />
          )}

          {/* Fullscreen previews */}
          <FullscreenPreview
            text={splitter.showFullscreen ? mergedText : ''}
            isOpen={splitter.showFullscreen}
            onClose={() => splitter.setShowFullscreen(false)}
            title={result.chapterCount
              ? <><BookOpen size={14} className="inline mr-1" /> Xem trước - {result.chapterCount} chương</>
              : <><BookOpen size={14} className="inline mr-1" /> Xem trước - {result.parts.length} phần</>}
          />

          {splitter.previewPartIndex !== null && (
            <FullscreenPreview
              text={result.parts[splitter.previewPartIndex]?.text || ''}
              isOpen
              onClose={() => splitter.setPreviewPartIndex(null)}
              title={<><BookOpen size={14} className="inline mr-1" /> {result.parts[splitter.previewPartIndex]?.text.split('\n')[0] || `Phần ${splitter.previewPartIndex + 1}`} ({splitter.previewPartIndex + 1}/{result.parts.length})</>}
              hasPrev={splitter.previewPartIndex > 0}
              hasNext={splitter.previewPartIndex < result.parts.length - 1}
              onPrev={() => splitter.setPreviewPartIndex(prev => prev !== null ? Math.max(0, prev - 1) : null)}
              onNext={() => splitter.setPreviewPartIndex(prev => prev !== null ? Math.min(result.parts.length - 1, prev + 1) : null)}
            />
          )}
        </div>
      )}

      <FullscreenPreview
        text={splitter.showInputFullscreen ? splitter.input : ''}
        isOpen={splitter.showInputFullscreen}
        onClose={() => splitter.setShowInputFullscreen(false)}
        title={<><BookOpen size={14} className="inline mr-1" /> Xem trước - Nội dung gốc</>}
      />
    </div>
  );
}
