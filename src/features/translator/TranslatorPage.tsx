import { useState, useCallback } from 'react';
import { useTranslatorWorker } from './hooks/useTranslatorWorker';
import { copyToClipboard } from '@/shared/utils/clipboard';
import { downloadAsTextFile } from '@/shared/utils/download';
import TokenViewer from './components/TokenViewer';
import TranslationEditorModal from './components/TranslationEditorModal';
import FindReplaceBar from './components/FindReplaceBar';
import type { TranslatedToken, DictType } from './engine/types';
import { Zap, Check, DownloadCloud, Clipboard, ArrowRight, Save } from 'lucide-react';

export default function TranslatorPage() {
  const { isReady, isLoading, api } = useTranslatorWorker();
  
  const [input, setInput] = useState('');
  const [vpTokens, setVpTokens] = useState<TranslatedToken[]>([]);
  const [hvTokens, setHvTokens] = useState<TranslatedToken[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeTab, setActiveTab] = useState<'vietphrase' | 'hanviet'>('vietphrase');
  const [showFindReplace, setShowFindReplace] = useState(false);
  
  // Editor state
  const [editingToken, setEditingToken] = useState<TranslatedToken | null>(null);

  const handleTranslate = useCallback(async () => {
    if (!api || !isReady || !input.trim()) return;
    try {
      setIsTranslating(true);
      const [vpRes, hvRes] = await Promise.all([
        api.translate(input, { prioritizeName: true, algorithm: 'longest', target: 'vietphrase' }),
        api.translate(input, { prioritizeName: true, algorithm: 'longest', target: 'hanviet' })
      ]);
      setVpTokens(vpRes);
      setHvTokens(hvRes);
    } catch (e) {
      console.error(e);
      alert('Lỗi dịch thuật: ' + String(e));
    } finally {
      setIsTranslating(false);
    }
  }, [api, isReady, input]);

  const handleUpdateDict = useCallback(async (type: DictType, key: string, newTranslation: string) => {
    if (!api || !isReady) return;
    try {
      await api.updateDictionary(type, key, newTranslation);
      // Retranslate to see changes
      handleTranslate();
    } catch (e) {
      console.error(e);
    }
  }, [api, isReady, handleTranslate]);

  const handleClear = () => {
    setInput('');
    setVpTokens([]);
    setHvTokens([]);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch {
      // Ignored
    }
  };

  const getResultText = useCallback(() => {
    const targetTokens = activeTab === 'vietphrase' ? vpTokens : hvTokens;
    if (!targetTokens.length) return '';
    return targetTokens.map(t => t.translated).join('').replace(/\[|\]/g, '');
  }, [activeTab, vpTokens, hvTokens]);

  const handleCopyResult = async () => {
    const text = getResultText();
    if (!text) return;
    await copyToClipboard(text);
  };

  const handleExportText = () => {
    const text = getResultText();
    if (!text) return;
    downloadAsTextFile(text, `translation_${activeTab}_${Date.now()}.txt`);
  };

  return (
    <div className="w-full mx-auto px-4 md:px-6 py-6 md:py-8 h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ animation: 'fadeIn 0.4s ease-out' }}>
        <h1 className="text-xl md:text-2xl font-bold text-gold flex items-center gap-2">
          <Zap size={28} className="text-gold" />
          Quick Translator
        </h1>
        <p className="text-sm text-text-secondary mt-1.5 flex items-center gap-2">
          Dịch tiếng Trung nhanh gọn. 
          {isLoading ? (
            <span className="text-crimson animate-pulse text-xs">Đang tải từ điển...</span>
          ) : (
            <span className="text-jade text-xs"><Check size={12} className="inline mr-0.5 -mt-0.5" /> Sẵn sàng</span>
          )}
        </p>
      </div>

      {/* Main Workspace: 2 columns on desktop, stacked on mobile */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0" style={{ animation: 'fadeIn 0.4s ease-out 0.1s both' }}>
        
        {/* Left: Input */}
        <div className="flex-1 flex flex-col min-h-0 bg-bg-card rounded-2xl border border-border-main overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-main bg-bg-secondary w-full shrink-0">
            <span className="text-sm font-medium text-text-secondary"><DownloadCloud size={14} className="inline mr-1 -mt-0.5" /> Tiếng Trung (Raw)</span>
            <div className="flex gap-2">
              <button onClick={() => setShowFindReplace(!showFindReplace)} className="text-xs text-text-dim hover:text-white px-2 py-1 transition-colors flex items-center gap-1">🔎 Tìm & Thay thế</button>
              <button onClick={handleClear} className="text-xs text-text-dim hover:text-crimson px-2 py-1 transition-colors">✕ Xóa</button>
              <button onClick={handlePaste} className="text-xs text-gold hover:text-gold-light px-2 py-1 transition-colors flex items-center gap-1"><Clipboard size={12} /> Dán</button>
            </div>
          </div>
          
          {showFindReplace && (
            <FindReplaceBar 
              text={input} 
              onReplaceText={setInput} 
              onClose={() => setShowFindReplace(false)} 
            />
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-transparent resize-none focus:outline-none text-text-primary text-[15px] leading-relaxed"
            placeholder="Nhập hoặc dán tiếng trung vào đây..."
          />
        </div>

        {/* Center: Action Buttons (Mobile: horizontal, Desktop: vertical) */}
        <div className="flex md:flex-col justify-center gap-3 shrink-0 items-center px-2 py-2">
           <button
            onClick={handleTranslate}
            disabled={!isReady || !input.trim() || isTranslating}
            className="flex-1 md:flex-none flex items-center justify-center bg-gold text-bg-primary font-semibold text-sm px-6 py-4 rounded-xl transition-all duration-300 hover:bg-gold-light active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed w-full shadow-lg shadow-gold/20"
          >
            {isTranslating ? 'Đang dịch...' : <span className="flex items-center">Dịch <ArrowRight size={16} className="ml-1.5" /></span>}
          </button>
        </div>

        {/* Right: Output */}
        <div className="flex-1 flex flex-col min-h-0 bg-bg-card rounded-2xl border border-border-main overflow-hidden">
           <div className="flex flex-wrap items-center justify-between px-2 py-2 border-b border-border-main bg-bg-secondary w-full shrink-0 gap-2">
            <div className="flex bg-bg-main p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('vietphrase')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'vietphrase' ? 'bg-bg-card text-text-primary shadow' : 'text-text-dim hover:text-text-secondary'}`}
              >
                VietPhrase
              </button>
              <button 
                onClick={() => setActiveTab('hanviet')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'hanviet' ? 'bg-bg-card text-text-primary shadow' : 'text-text-dim hover:text-text-secondary'}`}
              >
                Hán Việt
              </button>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={handleCopyResult} className="text-xs text-jade hover:text-jade-light px-2 py-1 transition-colors flex items-center gap-1"><Clipboard size={12} /> Copy</button>
              <button onClick={handleExportText} className="text-xs text-gold hover:text-gold-light px-2 py-1 transition-colors flex items-center gap-1"><Save size={12} /> Tải .txt</button>
            </div>
          </div>
          <div className="flex-1 p-4 bg-transparent overflow-y-auto w-full h-full">
            {(activeTab === 'vietphrase' ? vpTokens : hvTokens).length === 0 ? (
              <div className="text-text-dim/50 text-sm flex items-center justify-center h-full">
                Kết quả dịch hiển thị ở đây
              </div>
            ) : (
              <TokenViewer tokens={activeTab === 'vietphrase' ? vpTokens : hvTokens} onTokenClick={setEditingToken} />
            )}
          </div>
        </div>

      </div>

      <TranslationEditorModal 
        token={editingToken}
        isOpen={!!editingToken}
        onClose={() => setEditingToken(null)}
        onSave={handleUpdateDict}
      />
    </div>
  );
}
