import type { TtcChapter, ParsedChapter, SyncMode } from '../types';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Scale, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';

const ROWS_PER_PAGE = 100;

interface ResyncComparisonTableProps {
  remoteChapters: TtcChapter[];
  localChapters: ParsedChapter[];
  loading?: boolean;
  onAutoSelectMode: (mode: SyncMode, fromIndex?: number, toIndex?: number) => void;
}

export function ResyncComparisonTable({
  remoteChapters,
  localChapters,
  loading = false,
  onAutoSelectMode,
}: ResyncComparisonTableProps) {
  const [page, setPage] = useState(0);

  // Compute analysis and recommendation
  const analysis = useMemo(() => {
    let hasChanges = false;
    let newChaptersCount = 0;
    let firstChangedIndex: number | null = null;

    // remoteChapters is pre-sorted ascending in hook (fetchAllRemoteChapters)
    const rows = localChapters.map((local) => {
      const remote = remoteChapters[local.index - 1] ?? null;
      
      let status: 'match' | 'changed' | 'new' = 'match';
      let statusText = 'Khớp (Bỏ qua)';
      
      if (!remote) {
        status = 'new';
        statusText = 'Chương mới (Thêm vào)';
        newChaptersCount++;
      } else {
        // Check title mismatch (catches renumbering from chapter splits)
        const titleChanged = local.title.trim() !== remote.title.trim();
        // Allow ~3% variance in word count
        const larger = Math.max(local.word_count, remote.wordCount);
        const diff = Math.abs(local.word_count - remote.wordCount);
        const wordCountChanged = larger > 0 && diff / larger > 0.03;

        if (titleChanged || wordCountChanged) {
          status = 'changed';
          statusText = titleChanged ? 'Có thay đổi (Cần ghi đè)' : 'Có thay đổi (Cần ghi đè)';
          hasChanges = true;
          if (firstChangedIndex === null) firstChangedIndex = local.index;
        }
      }

      return { local, remote, status, statusText };
    });

    // Last local chapter's index (accounts for skipChapters offset, which makes
    // indices run from 1+skip .. length+skip rather than 1 .. length).
    const maxLocalIndex = localChapters.length > 0
      ? localChapters[localChapters.length - 1].index
      : 0;

    let recommendedMode: SyncMode = 'all';
    let recFromIndex = 1;
    let recToIndex = maxLocalIndex;
    let recommendationText = '';

    if (!hasChanges && newChaptersCount > 0) {
      recommendedMode = 'append';
      recommendationText = `Tất cả chương cũ đều khớp. Đề xuất: Tiếp nối (Append) để thêm ${newChaptersCount} chương mới.`;
    } else if (hasChanges) {
      recommendedMode = 'range';
      recFromIndex = firstChangedIndex || 1;
      recToIndex = maxLocalIndex;
      recommendationText = `Phát hiện thay đổi từ chương ${recFromIndex}. Đề xuất: Ghi đè theo vùng (Range) từ chương ${recFromIndex} đến ${recToIndex}.`;
    } else if (newChaptersCount === 0 && !hasChanges) {
      recommendedMode = 'all';
      recommendationText = 'Mọi chương đều khớp. Không cần cập nhật.';
    }

    return { rows, recommendedMode, recFromIndex, recToIndex, recommendationText, firstChangedIndex };
  }, [localChapters, remoteChapters]);

  // Pagination
  const totalPages = Math.ceil(analysis.rows.length / ROWS_PER_PAGE);
  const paginatedRows = useMemo(() => {
    const start = page * ROWS_PER_PAGE;
    return analysis.rows.slice(start, start + ROWS_PER_PAGE);
  }, [analysis.rows, page]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTriggerId, setScrollTriggerId] = useState(0);

  // Auto-navigate to the page containing the first changed chapter, or reset to 0
  useEffect(() => {
    if (analysis.firstChangedIndex !== null) {
      const targetArrayIndex = analysis.rows.findIndex(r => r.local.index === analysis.firstChangedIndex);
      if (targetArrayIndex >= 0) {
        const targetPage = Math.floor(targetArrayIndex / ROWS_PER_PAGE);
        setPage(targetPage);
        setScrollTriggerId(id => id + 1); // Trigger scroll
        return;
      }
    }
    setPage(0);
  }, [localChapters, remoteChapters, analysis.firstChangedIndex, analysis.rows]);

  // Auto-scroll to the row
  useEffect(() => {
    if (scrollTriggerId === 0 || analysis.firstChangedIndex === null) return;
    
    const targetArrayIndex = analysis.rows.findIndex(r => r.local.index === analysis.firstChangedIndex);
    if (targetArrayIndex >= 0) {
      const targetPage = Math.floor(targetArrayIndex / ROWS_PER_PAGE);
      if (page === targetPage) {
        // Delay to allow DOM update and initial slideUp animation to complete
        const timer = setTimeout(() => {
          if (scrollContainerRef.current) {
            const row = scrollContainerRef.current.querySelector(`tr[data-chapter-index="${analysis.firstChangedIndex}"]`);
            if (row) {
              row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [scrollTriggerId, page, analysis.firstChangedIndex, analysis.rows]);

  return (
    <div className="bg-bg-card border border-border-main rounded-xl overflow-hidden mt-4 flex flex-col flex-1 min-h-0" style={{ animation: 'slideUp 0.3s ease-out 0.1s both' }}>
      {/* Header & Recommendation */}
      <div className="flex-shrink-0 px-4 py-3 bg-bg-hover/50 border-b border-border-main z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2 whitespace-nowrap">
          <span><Scale size={18} /></span> So sánh dữ liệu Resync
          <span className="text-xs font-normal text-text-dim bg-bg-primary px-2 py-0.5 rounded-full">
            {localChapters.length} chương Local
          </span>
          <span className="text-xs font-normal text-text-dim bg-bg-primary px-2 py-0.5 rounded-full">
            {remoteChapters.length} chương TTC
          </span>
        </h2>
        
        {localChapters.length > 0 && (
          <div className="flex items-center gap-3 bg-bg-primary border border-border-main px-3 py-1.5 rounded-lg flex-1 sm:flex-none">
            <span className="text-[11px] text-text-secondary truncate" title={analysis.recommendationText}>
              <Lightbulb size={12} className="inline mr-1 -mt-0.5" /> {analysis.recommendationText}
            </span>
            {analysis.recommendedMode && (analysis.recommendedMode !== 'all' || analysis.recommendationText.includes('Ghi đè')) && (
              <button
                onClick={() => onAutoSelectMode(analysis.recommendedMode, analysis.recFromIndex, analysis.recToIndex)}
                className="text-xs px-2.5 py-1 bg-gold/10 border border-gold/30 text-gold rounded hover:bg-gold/20 hover:border-gold/50 transition-colors cursor-pointer font-medium whitespace-nowrap"
              >
                Chọn Mode này
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 px-4 py-2 bg-bg-card border-b border-border-main flex items-center justify-between">
          <span className="text-[11px] text-text-dim">
            Hiện {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, analysis.rows.length)} / {analysis.rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-0.5 text-[11px] rounded border border-border-main bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
            >
              <ChevronLeft size={12} className="inline mr-0.5 -mt-0.5" /> Trước
            </button>
            <span className="text-[11px] text-text-dim px-2">
              {page + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-0.5 text-[11px] rounded border border-border-main bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
            >
              Sau <ChevronRight size={12} className="inline ml-0.5 -mt-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative min-h-[300px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-text-dim">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <span>Đang tải toàn bộ danh sách chương từ TTC...</span>
          </div>
        ) : localChapters.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-text-dim">
            Vui lòng chọn Folder để phân tích chương Local.
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg-hover/80 backdrop-blur-md sticky top-0 z-10 text-xs text-text-secondary shadow-sm">
              <tr>
                <th className="px-4 py-2 font-medium w-16 text-center border-b border-border-main">Chương</th>
                <th className="px-4 py-2 font-medium border-b border-border-main">Tên (TTC)</th>
                <th className="px-4 py-2 font-medium w-24 text-right border-b border-border-main">Chữ (TTC)</th>
                <th className="px-4 py-2 font-medium border-b border-border-main border-l bg-bg-primary/30">Tên (Local)</th>
                <th className="px-4 py-2 font-medium w-24 text-right border-b border-border-main bg-bg-primary/30">Chữ (Local)</th>
                <th className="px-4 py-2 font-medium w-40 text-center border-b border-border-main">Đánh giá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {paginatedRows.map((row) => (
                <tr key={row.local.index} data-chapter-index={row.local.index} className="hover:bg-bg-hover/50 transition-colors text-text-primary">
                  <td className="px-4 py-2 text-center text-text-dim text-xs font-mono">{row.local.index}</td>
                  
                  {/* TTC Data */}
                  <td className={`px-4 py-2 max-w-[150px] md:max-w-[200px] truncate ${!row.remote ? 'text-text-dim italic' : ''}`}>
                    {row.remote ? row.remote.title : '-'}
                  </td>
                  <td className="px-4 py-2 text-right text-text-dim text-xs font-mono">
                    {row.remote && row.remote.wordCount > 0 ? row.remote.wordCount.toLocaleString() : '-'}
                  </td>

                  {/* Local Data */}
                  <td className="px-4 py-2 max-w-[150px] md:max-w-[200px] truncate border-l border-border-main bg-bg-primary/10">
                    {row.local.title}
                  </td>
                  <td className="px-4 py-2 text-right text-text-dim text-xs font-mono bg-bg-primary/10">
                    {row.local.word_count.toLocaleString()}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2 text-center">
                    {row.status === 'match' && (
                      <span className="inline-block px-2 py-0.5 bg-bg-hover text-text-dim border border-border-main rounded text-[10px] uppercase font-semibold">
                        {row.statusText}
                      </span>
                    )}
                    {row.status === 'changed' && (
                      <span className="inline-block px-2 py-0.5 bg-gold/10 text-gold border border-gold/30 rounded text-[10px] uppercase font-semibold">
                        {row.statusText}
                      </span>
                    )}
                    {row.status === 'new' && (
                      <span className="inline-block px-2 py-0.5 bg-jade/10 text-jade border border-jade/30 rounded text-[10px] uppercase font-semibold">
                        {row.statusText}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
