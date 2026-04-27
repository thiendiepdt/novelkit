import type { SplitResult } from '../utils/splitter';
import type { MiniMapMarker } from '@/shared/components/MiniMapTextarea';
import MiniMapTextarea from '@/shared/components/MiniMapTextarea';
import { Check, Clipboard } from 'lucide-react';

interface PartTabsViewProps {
  result: SplitResult;
  activeTab: number;
  setActiveTab: (tab: number) => void;
  mergedText: string;
  mergedMarkers: MiniMapMarker[];
  showTabs: boolean;
  copiedIndex: number | null;
  onCopy: (text: string, index: number) => void;
}

export default function PartTabsView({
  result, activeTab, setActiveTab, mergedText, mergedMarkers,
  showTabs, copiedIndex, onCopy,
}: PartTabsViewProps) {
  return (
    <>
      {showTabs && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveTab(-1)}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
              activeTab === -1
                ? 'bg-gold/20 text-gold border border-gold/50'
                : 'bg-bg-secondary text-text-dim border border-border-main hover:bg-bg-card hover:text-text-primary hover:border-border-gold/50'
            }`}
          >
            <span>📄 Một File</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === -1 ? 'bg-gold/20 text-gold' : 'bg-bg-card border border-border-main text-text-secondary'}`}>
              {result.totalWords} chữ
            </span>
          </button>
          {result.parts.map((part, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
                activeTab === index
                  ? 'bg-gold/20 text-gold border border-gold/50'
                  : 'bg-bg-secondary text-text-dim border border-border-main hover:bg-bg-card hover:text-text-primary hover:border-border-gold/50'
              }`}
            >
              <span>Phần {index + 1}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === index ? 'bg-gold/20 text-gold' : 'bg-bg-card border border-border-main text-text-secondary'}`}>
                {part.wordCount} chữ
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="bg-bg-card border border-border-main rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-border-main bg-bg-secondary/50">
          <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
            {(!showTabs || activeTab === -1)
              ? (result.chapterCount
                  ? `📄 Tất cả ${result.chapterCount} chương (${result.parts.length} phần)`
                  : '📄 Một File (tất cả các phần)')
              : `Phần ${activeTab + 1}`}
            <span className="text-xs font-normal text-text-dim">
              ({(!showTabs || activeTab === -1) ? result.totalWords : result.parts[activeTab]?.wordCount} chữ)
            </span>
          </span>
          <button
            onClick={() => onCopy(
              (!showTabs || activeTab === -1) ? mergedText : (result.parts[activeTab]?.text || ''),
              activeTab,
            )}
            className={`text-xs font-medium transition-all duration-200 px-3 py-1.5 rounded-lg active:scale-95 ${
              copiedIndex === activeTab
                ? 'bg-jade/20 border border-jade/40 text-jade'
                : 'bg-bg-card border border-border-main text-text-secondary hover:border-border-gold hover:text-gold'
            }`}
          >
            {copiedIndex === activeTab ? <><Check size={12} className="inline mr-1" /> Copied</> : <><Clipboard size={12} className="inline mr-1" /> Copy</>}
          </button>
        </div>
        <MiniMapTextarea
          readOnly
          value={(!showTabs || activeTab === -1) ? mergedText : (result.parts[activeTab]?.text || '')}
          className="w-full bg-transparent p-4 text-sm leading-relaxed text-text-primary focus:outline-none resize-none"
          rows={(!showTabs || activeTab === -1) ? 18 : 12}
          markers={(!showTabs || activeTab === -1) ? mergedMarkers : undefined}
        />
      </div>
    </>
  );
}
