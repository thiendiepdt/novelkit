interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const visiblePages = Array.from({ length: totalPages }, (_, i) => i)
    .filter(i => i === 0 || i === totalPages - 1 || Math.abs(i - currentPage) <= 1);

  return (
    <div className="flex items-center justify-center gap-2 p-3 border-t border-border-main bg-bg-secondary/30">
      <button
        onClick={() => onPageChange(0)}
        disabled={currentPage === 0}
        className="text-xs font-medium px-2 py-1.5 rounded-md bg-bg-secondary border border-border-main text-text-secondary hover:text-text-primary hover:border-border-gold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ⟪
      </button>
      <button
        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-bg-secondary border border-border-main text-text-secondary hover:text-text-primary hover:border-border-gold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ‹ Trước
      </button>
      <div className="flex items-center gap-1">
        {visiblePages.map((pageNum, idx, arr) => {
          const showEllipsis = idx > 0 && pageNum - arr[idx - 1] > 1;
          return (
            <span key={pageNum} className="flex items-center gap-1">
              {showEllipsis && <span className="text-xs text-text-dim px-1">…</span>}
              <button
                onClick={() => onPageChange(pageNum)}
                className={`text-xs font-medium w-7 h-7 rounded-md transition-all ${
                  currentPage === pageNum
                    ? 'bg-gold/20 text-gold border border-gold/50'
                    : 'text-text-dim hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                {pageNum + 1}
              </button>
            </span>
          );
        })}
      </div>
      <button
        onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
        disabled={currentPage >= totalPages - 1}
        className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-bg-secondary border border-border-main text-text-secondary hover:text-text-primary hover:border-border-gold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Sau ›
      </button>
      <button
        onClick={() => onPageChange(totalPages - 1)}
        disabled={currentPage >= totalPages - 1}
        className="text-xs font-medium px-2 py-1.5 rounded-md bg-bg-secondary border border-border-main text-text-secondary hover:text-text-primary hover:border-border-gold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ⟫
      </button>
    </div>
  );
}
