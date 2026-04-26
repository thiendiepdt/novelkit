import { useLocation } from 'react-router-dom';

const routeNames: Record<string, string> = {
  '/': 'Trang chủ',
  '/text-formatter': 'Format Truyện',
  '/chapter-splitter': 'Chia Chương',
  '/quick-translator': 'Dịch Nhanh (QT Web)',
  '/ttc-uploader': 'TTC Uploader',
};

export default function StatusBar() {
  const location = useLocation();
  const currentRouteName = routeNames[location.pathname] || 'NovelKit';

  return (
    <div className="h-6 bg-bg-card border-t border-border-main flex items-center justify-between px-3 text-[10px] text-text-dim flex-shrink-0 z-20">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 hover:text-text-primary transition-colors cursor-default">
          <span className="w-2 h-2 rounded-full bg-jade/80 shadow-[0_0_4px_rgba(74,222,128,0.5)]"></span>
          Ready
        </span>
        <span className="hidden sm:block text-text-dim/50">|</span>
        <span className="hidden sm:block uppercase tracking-wider">{currentRouteName}</span>
      </div>
      
      <div className="flex items-center gap-4">
        <span className="hover:text-gold transition-colors cursor-default">Tauri Workspace</span>
        <span className="text-text-dim/50">|</span>
        <span className="font-medium text-gold/80 hover:text-gold transition-colors cursor-default">⚙ NovelKit</span>
      </div>
    </div>
  );
}
