import type { FormatResult } from '../utils/formatter';

interface StatsPanelProps {
  result: FormatResult;
}

export default function StatsPanel({ result }: StatsPanelProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        label="Số chữ"
        value={result.charCount.toLocaleString('vi-VN')}
        color="gold"
      />
      <StatCard
        label="Đoạn văn"
        value={result.paragraphCount.toString()}
        color="purple"
      />
      <StatCard
        label="Tổng ký tự"
        value={result.charCountWithSpaces.toLocaleString('vi-VN')}
        color="jade"
      />
      <StatCard
        label="Chữ Trung"
        value={result.hasChinese ? `${result.chineseChars.length} ký tự` : 'Không có'}
        color={result.hasChinese ? 'crimson' : 'jade'}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: 'gold' | 'jade' | 'purple' | 'crimson';
}

const colorMap = {
  gold: {
    border: 'border-border-gold',
    value: 'text-gold',
    bg: 'bg-gold-glow/30',
  },
  jade: {
    border: 'border-jade/30',
    value: 'text-jade',
    bg: 'bg-jade/10',
  },
  purple: {
    border: 'border-purple/30',
    value: 'text-purple',
    bg: 'bg-purple/10',
  },
  crimson: {
    border: 'border-crimson/30',
    value: 'text-crimson',
    bg: 'bg-crimson/10',
  },
};

function StatCard({ label, value, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      className={`${c.bg} border ${c.border} rounded-xl p-2.5 md:p-3 text-center transition-all duration-300`}
    >
      <div className={`text-base md:text-lg font-bold ${c.value}`}>{value}</div>
      <div className="text-[11px] text-text-dim mt-0.5">{label}</div>
    </div>
  );
}
