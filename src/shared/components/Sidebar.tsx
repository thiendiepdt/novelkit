import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, Scissors, Zap, Upload, Download } from 'lucide-react';

const navItems = [
  { id: 'home', icon: <Home size={20} />, path: '/', title: 'Trang chủ' },
  { id: 'text-formatter', icon: <FileText size={20} />, path: '/text-formatter', title: 'Format Truyện' },
  { id: 'chapter-splitter', icon: <Scissors size={20} />, path: '/chapter-splitter', title: 'Chia Chương' },
  { id: 'quick-translator', icon: <Zap size={20} />, path: '/quick-translator', title: 'Dịch Nhanh' },
  { id: 'ttc-uploader', icon: <Upload size={20} />, path: '/ttc-uploader', title: 'TTC Uploader' },
  { id: 'downloads', icon: <Download size={20} />, path: '/downloads', title: 'Quản lý tải xuống' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-14 bg-bg-card border-r border-border-main flex flex-col items-center py-4 gap-2 flex-shrink-0 z-10">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.id}
            to={item.path}
            title={item.title}
            className={`w-10 h-10 flex items-center justify-center rounded-xl text-xl transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-gold/15 text-gold border border-gold/30 shadow-[0_0_10px_rgba(212,165,116,0.1)]'
                : 'text-text-dim border border-transparent hover:text-text-primary hover:bg-bg-hover hover:border-border-main'
            }`}
          >
            {item.icon}
          </Link>
        );
      })}
    </aside>
  );
}
