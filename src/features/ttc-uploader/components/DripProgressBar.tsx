/** Thin bar: chapters on TTC out of the folder. */
export function DripProgressBar({ posted, total, className = '' }: { posted: number; total: number; className?: string }) {
  const ratio = total > 0 ? Math.min(1, posted / total) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={posted}
      className={`h-1.5 rounded-full bg-bg-hover overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${ratio >= 1 ? 'bg-jade' : 'bg-gold'}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
