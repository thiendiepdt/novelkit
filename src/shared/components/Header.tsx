import { Link, useLocation } from 'react-router-dom';
import { isTauri } from '@/shared/utils/platform';
import { Settings, ArrowLeft } from 'lucide-react';
import { DownloadQueueManager, UploadQueueManager } from '@/shared/components';
import { Tooltip } from './Tooltip';
import { useSettingsModal } from '@/features/settings/context/SettingsModalContext';

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const showHomeLink = !isHome && !isTauri();
  const { openSettings } = useSettingsModal();

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b border-border-main px-4 md:px-6"
      style={{ background: 'linear-gradient(180deg, rgba(18,18,18,0.98) 0%, rgba(18,18,18,0.88) 100%)' }}
    >
      <div className="w-full mx-auto flex items-center justify-between h-14 md:h-16">
        <Link
          to="/"
          className="flex items-center gap-2 text-gold text-lg md:text-xl font-bold whitespace-nowrap tracking-wide"
        >
          <span className="flex items-center justify-center mr-1"><Settings className="w-5 h-5 md:w-6 md:h-6" /></span>
          NovelKit
        </Link>

        <div className="flex items-center gap-4">
          {showHomeLink && (
            <Link
              to="/"
              className="text-sm text-text-secondary hover:text-gold transition-all duration-300 flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Trang chủ</span>
            </Link>
          )}
          <Tooltip content="Cài đặt hệ thống" side="bottom">
            <button
              onClick={() => openSettings()}
              className="text-text-secondary hover:text-gold transition-colors flex items-center justify-center text-lg cursor-pointer"
            >
              <Settings size={20} />
            </button>
          </Tooltip>
          <UploadQueueManager />
          <DownloadQueueManager />
        </div>
      </div>
    </header>
  );
}
