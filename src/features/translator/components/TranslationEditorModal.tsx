import { useState, useEffect } from 'react';
import type { TranslatedToken, DictType } from '../engine/types';

interface Props {
  token: TranslatedToken | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (type: DictType, key: string, newValue: string) => void;
}

export default function TranslationEditorModal({ token, isOpen, onClose, onSave }: Props) {
  const [value, setValue] = useState('');
  const [selectedDict, setSelectedDict] = useState<DictType>('vietphrase');

  // Sync local state when a new token is selected for editing.
  // This is intentional: we want to reset the form fields when the prop changes.
  useEffect(() => {
    if (token) {
      let cleanVal = token.translated;
      if (cleanVal.startsWith('[') && cleanVal.endsWith(']')) {
        cleanVal = cleanVal.slice(1, -1);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: reset form on new token selection
      setValue(cleanVal);
      setSelectedDict(token.dictType || 'vietphrase');
    }
  }, [token]);

  if (!isOpen || !token) return null;

  const handleSave = () => {
    onSave(selectedDict, token.original, value);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div 
        className="w-full max-w-sm bg-bg-secondary border border-border-main rounded-2xl shadow-xl overflow-hidden"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-main bg-bg-card">
          <h3 className="font-semibold text-text-primary">Sửa nghĩa từ</h3>
          <button onClick={onClose} className="text-text-dim hover:text-text-primary p-1">✕</button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="block text-xs text-text-dim">Tiếng Trung gốc</label>
              <a 
                href={`https://baike.baidu.com/item/${encodeURIComponent(token.original)}`}
                target="_blank"
                rel="noreferrer" 
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                🔍 Tra Baidu Baike
              </a>
            </div>
            <div className="text-lg font-bold text-gold">{token.original}</div>
          </div>

          <div>
            <label className="block text-xs text-text-dim mb-1.5">Loại từ điển cập nhật</label>
            <div className="flex bg-bg-main p-1 rounded-lg">
              <button 
                onClick={() => setSelectedDict('vietphrase')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${selectedDict === 'vietphrase' ? 'bg-bg-card text-text-primary shadow' : 'text-text-dim'}`}
              >
                VietPhrase
              </button>
              <button 
                onClick={() => setSelectedDict('name')}
                className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${selectedDict === 'name' ? 'bg-bg-card text-text-primary shadow' : 'text-text-dim'}`}
              >
                Name
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-dim mb-1">Nghĩa mới (ngăn cách bởi /)</label>
            <input 
              type="text" 
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border-main bg-bg-card flex gap-2 justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Hủy
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 text-xs font-medium bg-gold text-bg-primary rounded-lg hover:bg-gold-light transition-colors shadow-lg shadow-gold/20"
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
