import type { TranslatedToken } from '../engine/types';

interface Props {
  tokens: TranslatedToken[];
  onTokenClick: (token: TranslatedToken) => void;
}

export default function TokenViewer({ tokens, onTokenClick }: Props) {
  // QT logic: formatting "[translation]" for multi-meaning words
  // Here we visually represent them.
  
  return (
    <div className="leading-[2] md:leading-[2.2] text-[15px] md:text-base text-text-primary whitespace-pre-wrap break-words">
      {tokens.map((token, idx) => {
        if (token.type === 'latin' || token.type === 'punctuation') {
          return <span key={idx}>{token.translated}</span>;
        }

        // Determine color based on dictionary type
        let colorClass = 'text-text-primary hover:text-gold';
        if (token.type === 'name') colorClass = 'text-purple hover:text-purple/80 font-medium'; // Vietnamese editors like styling names distinctively
        if (token.type === 'chinese_unmapped') colorClass = 'text-crimson font-medium bg-crimson/10'; // Red for unmapped chinese

        const displayText = token.translated;
        const isMultiMeaning = token.hasOneMeaning === false;

        return (
          <span
            key={idx}
            onClick={() => onTokenClick(token)}
            className={`cursor-pointer transition-colors duration-150 inline-block px-0.5 rounded ${colorClass} hover:bg-gold-glow/20 active:scale-95`}
            title={token.original} // browser Native tooltip
          >
            {isMultiMeaning ? <span className="text-text-dim opacity-70">[</span> : ''}
            {displayText}
            {isMultiMeaning ? <span className="text-text-dim opacity-70">]</span> : ''}
          </span>
        );
      })}
    </div>
  );
}
