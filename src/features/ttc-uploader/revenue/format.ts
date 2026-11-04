/** Hoa with Vietnamese digit grouping: 12.345 */
export const formatHoa = (n: number) => n.toLocaleString('vi-VN');

/**
 * Round axis values from 0 to at least `max`, about `count` steps of 1, 2, 2.5 or 5 × 10ⁿ.
 * Only [0] when there is nothing to show.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const unit = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * unit).find((s) => s >= rough) ?? 10 * unit;
  // Whole numbers: hoa do not come in fractions.
  const whole = Math.max(1, Math.ceil(step));
  const ticks = [0];
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + whole);
  return ticks;
}
