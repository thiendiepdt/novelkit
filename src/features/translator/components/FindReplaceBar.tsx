import { useState } from 'react';

interface Props {
  text: string;
  onReplaceText: (newText: string) => void;
  onClose: () => void;
}

export default function FindReplaceBar({ text, onReplaceText, onClose }: Props) {
  const [findStr, setFindStr] = useState('');
  const [replaceStr, setReplaceStr] = useState('');
  
  const handleReplaceAll = () => {
    if (!findStr) return;
    const count = text.split(findStr).length - 1;
    if (count === 0) {
      alert('Không tìm thấy chuỗi nào để thay thế!');
      return;
    }
    
    // Replace all using regex global
    const escapedFind = findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const newText = text.replace(new RegExp(escapedFind, 'g'), replaceStr);
    
    onReplaceText(newText);
    alert(`Đã thay thế ${count} chỗ thành công.`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-bg-card border-b border-border-main" style={{ animation: 'slideDown 0.2s ease-out' }}>
      <div className="flex-1 flex flex-wrap items-center gap-2 min-w-[280px]">
        <input 
          type="text" 
          placeholder="Tìm kiếm..." 
          value={findStr}
          onChange={e => setFindStr(e.target.value)}
          className="flex-1 bg-bg-main border border-border-main rounded-md px-3 py-1.5 text-xs focus:border-gold outline-none text-text-primary min-w-[120px]"
        />
        <span className="text-text-dim text-xs">→</span>
        <input 
          type="text" 
          placeholder="Thay thế bằng..." 
          value={replaceStr}
          onChange={e => setReplaceStr(e.target.value)}
          className="flex-1 bg-bg-main border border-border-main rounded-md px-3 py-1.5 text-xs focus:border-gold outline-none text-text-primary min-w-[120px]"
        />
      </div>
      <div className="flex gap-2">
        <button 
          onClick={handleReplaceAll}
          disabled={!findStr}
          className="px-3 py-1.5 bg-gold/10 text-gold hover:bg-gold/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-medium transition-colors border border-gold/20"
        >
          Thay thế tất cả
        </button>
        <button 
          onClick={onClose}
          className="px-3 py-1.5 text-text-secondary hover:text-crimson bg-bg-main border border-border-main hover:border-crimson rounded-md text-xs transition-colors"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
