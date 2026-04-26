import type { SplitResult } from '../utils/splitter';

interface SplitterStatsProps {
  result: SplitResult;
}

export default function SplitterStats({ result }: SplitterStatsProps) {
  return (
    <div className="flex flex-wrap gap-3 mb-6 bg-slate-900/40 border border-slate-800/60 p-4 rounded-xl">
      {result.chapterCount && (
        <>
          <div className="flex flex-col">
            <span className="text-xs text-text-dim uppercase tracking-wider mb-1 font-semibold">Số chương</span>
            <span className="text-xl font-bold text-purple tracking-tight">{result.chapterCount}</span>
          </div>
          <div className="w-[1px] bg-border-main self-stretch mx-2" />
        </>
      )}
      <div className="flex flex-col">
        <span className="text-xs text-text-dim uppercase tracking-wider mb-1 font-semibold">Tổng số phần</span>
        <span className="text-xl font-bold tracking-tight">{result.parts.length}</span>
      </div>
      <div className="w-[1px] bg-border-main self-stretch mx-2" />
      <div className="flex flex-col">
        <span className="text-xs text-text-dim uppercase tracking-wider mb-1 font-semibold">Tổng số chữ</span>
        <span className="text-xl font-bold tracking-tight">
          {new Intl.NumberFormat('en-US').format(result.totalWords)}
        </span>
      </div>
    </div>
  );
}
