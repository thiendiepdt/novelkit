import type { PartData } from '../utils/splitter';
import Pagination from './Pagination';
import { ClipboardList, Save, Check, Clipboard } from 'lucide-react';

interface PartListViewProps {
  paginatedParts: { part: PartData; globalIndex: number }[];
  copiedIndex: number | null;
  listPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPreview: (index: number) => void;
  onDownload: (text: string, index: number) => void;
  onCopy: (text: string, index: number) => void;
}

export default function PartListView({
  paginatedParts, copiedIndex, listPage, totalPages,
  onPageChange, onPreview, onDownload, onCopy,
}: PartListViewProps) {
  return (
    <div className="bg-bg-card border border-border-main rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border-main bg-bg-secondary/50">
        <span className="text-sm font-semibold text-text-primary"><ClipboardList size={14} className="inline mr-1 -mt-0.5" /> Danh sách phần</span>
        <span className="text-xs text-text-dim">Trang {listPage + 1}/{totalPages}</span>
      </div>

      <div className="divide-y divide-border-main">
        {paginatedParts.map(({ part, globalIndex }) => {
          const heading = part.text.split('\n')[0] || `Phần ${globalIndex + 1}`;
          return (
            <div
              key={globalIndex}
              className="flex items-center gap-3 px-4 py-3 hover:bg-bg-card-hover transition-colors duration-150 group"
            >
              <span className="text-xs text-text-dim font-mono w-8 shrink-0 text-right">
                {globalIndex + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate" title={heading}>{heading}</p>
              </div>
              <span className="text-xs text-text-secondary font-mono whitespace-nowrap">
                {new Intl.NumberFormat('en-US').format(part.wordCount)} chữ
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onPreview(globalIndex)}
                  className="text-xs font-medium px-2 py-1 rounded-md transition-all duration-200 active:scale-95 bg-bg-secondary border border-border-main text-text-dim opacity-0 group-hover:opacity-100 hover:text-gold hover:border-border-gold"
                  title="Xem trước"
                >
                  👁
                </button>
                <button
                  onClick={() => onDownload(part.text, globalIndex)}
                  className="text-xs font-medium px-2 py-1 rounded-md transition-all duration-200 active:scale-95 bg-bg-secondary border border-border-main text-text-dim opacity-0 group-hover:opacity-100 hover:text-jade hover:border-jade/50"
                  title="Tải về"
                >
                  <Save size={14} className="inline" />
                </button>
                <button
                  onClick={() => onCopy(part.text, globalIndex)}
                  className={`text-xs font-medium px-2 py-1 rounded-md transition-all duration-200 active:scale-95 ${
                    copiedIndex === globalIndex
                      ? 'bg-jade/20 border border-jade/40 text-jade'
                      : 'bg-bg-secondary border border-border-main text-text-dim opacity-0 group-hover:opacity-100 hover:text-gold hover:border-border-gold'
                  }`}
                  title="Copy"
                >
                  {copiedIndex === globalIndex ? <Check size={14} className="inline" /> : <Clipboard size={14} className="inline" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination currentPage={listPage} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
