import { DEFAULTS } from '../constants';

interface SplitterSettingsProps {
  maxWords: number;
  setMaxWords: (v: number) => void;
  roundUp: boolean;
  setRoundUp: (v: boolean) => void;
  minWords: number;
  setMinWords: (v: number) => void;
}

export default function SplitterSettings({
  maxWords, setMaxWords,
  roundUp, setRoundUp,
  minWords, setMinWords,
}: SplitterSettingsProps) {
  return (
    <div className="mb-4 bg-bg-card border border-border-main p-4 rounded-xl" style={{ animation: 'fadeIn 0.4s ease-out 0.05s both' }}>
      {/* Max words */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="max-words" className="text-sm font-medium text-text-primary whitespace-nowrap">
            Số chữ tối đa 1 phần:
          </label>
          <div className="flex items-center gap-2 w-[100px]">
            <input
              id="max-words"
              type="number"
              min={100}
              step={100}
              value={maxWords}
              onChange={(e) => setMaxWords(parseInt(e.target.value) || DEFAULTS.MAX_WORDS)}
              className="w-full bg-bg-secondary border border-border-main rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-border-gold focus:ring-1 focus:ring-border-gold/30 transition-all font-mono"
            />
          </div>
          <span className="text-xs text-text-dim hidden sm:inline">chữ</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <span className="text-xs text-text-dim mr-1 hidden sm:inline">Gợi ý:</span>
          {DEFAULTS.MAX_WORDS_PRESETS.map(val => (
            <button
              key={val}
              onClick={() => setMaxWords(val)}
              className={`text-xs font-medium px-2 py-1 rounded-md transition-all ${
                maxWords === val
                  ? 'bg-gold/20 text-gold border border-gold/40'
                  : 'bg-bg-secondary text-text-secondary border border-border-main hover:text-text-primary hover:border-gold/50'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Round mode */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border-main">
        <span className="text-sm font-medium text-text-primary whitespace-nowrap">Kiểu chia:</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setRoundUp(false)}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${
              !roundUp
                ? 'bg-gold/20 text-gold border border-gold/40'
                : 'bg-bg-secondary text-text-secondary border border-border-main hover:text-text-primary hover:border-gold/50'
            }`}
          >
            ↓ Tròn xuống
          </button>
          <button
            onClick={() => setRoundUp(true)}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${
              roundUp
                ? 'bg-gold/20 text-gold border border-gold/40'
                : 'bg-bg-secondary text-text-secondary border border-border-main hover:text-text-primary hover:border-gold/50'
            }`}
          >
            ↑ Tròn lên
          </button>
        </div>
        <span className="text-[11px] text-text-dim hidden sm:inline">
          {roundUp ? 'Phần có thể hơn giới hạn 1 chút' : 'Phần luôn ≤ giới hạn'}
        </span>
      </div>

      {/* Min words */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3 pt-3 border-t border-border-main">
        <div className="flex items-center gap-3">
          <label htmlFor="min-words" className="text-sm font-medium text-text-primary whitespace-nowrap">
            Số chữ tối thiểu 1 phần:
          </label>
          <div className="flex items-center gap-2 w-[100px]">
            <input
              id="min-words"
              type="number"
              min={0}
              step={100}
              value={minWords}
              onChange={(e) => setMinWords(parseInt(e.target.value) || 0)}
              className="w-full bg-bg-secondary border border-border-main rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-border-gold focus:ring-1 focus:ring-border-gold/30 transition-all font-mono"
            />
          </div>
          <span className="text-xs text-text-dim hidden sm:inline">chữ</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <span className="text-xs text-text-dim mr-1 hidden sm:inline">Gợi ý:</span>
          {DEFAULTS.MIN_WORDS_PRESETS.map(val => (
            <button
              key={val}
              onClick={() => setMinWords(val)}
              className={`text-xs font-medium px-2 py-1 rounded-md transition-all ${
                minWords === val
                  ? 'bg-gold/20 text-gold border border-gold/40'
                  : 'bg-bg-secondary text-text-secondary border border-border-main hover:text-text-primary hover:border-gold/50'
              }`}
            >
              {val === 0 ? 'Tắt' : val}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-text-dim hidden sm:inline">
          {minWords > 0 ? 'Phần cuối quá ngắn sẽ gộp vào phần trước' : 'Không giới hạn'}
        </span>
      </div>
    </div>
  );
}
