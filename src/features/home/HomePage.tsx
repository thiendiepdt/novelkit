import { Link } from 'react-router-dom';
import { isTauri } from '@/shared/utils/platform';
import { FileText, Scissors, Zap, Upload, Sparkles, ArrowRight } from 'lucide-react';
interface Tool {
  id: string;
  icon: React.ReactNode;
  name: string;
  description: string;
  path: string;
  badge?: string;
  desktopOnly?: boolean;
}

const tools: Tool[] = [
  {
    id: 'text-formatter',
    icon: <FileText size={36} strokeWidth={1.5} />,
    name: 'Format Truyện',
    description: 'Tự động format đoạn văn, xóa khoảng trắng đầu dòng, kiểm tra chữ Trung, đếm số chữ.',
    path: '/text-formatter',
    badge: 'Mới',
  },
  {
    id: 'chapter-splitter',
    icon: <Scissors size={36} strokeWidth={1.5} />,
    name: 'Chia Chương',
    description: 'Cắt một chương truyện dài thành nhiều phần nhỏ để đăng mượt mà, không bị cắt xén đoạn văn.',
    path: '/chapter-splitter',
    badge: 'Mới',
  },
  {
    id: 'quick-translator',
    icon: <Zap size={36} strokeWidth={1.5} />,
    name: 'Dịch Nhanh (QT Web)',
    description: 'Dịch Tiếng Trung siêu tốc sử dụng từ điển hệ QuickTranslator. Chỉnh sửa nghĩa bằng click.',
    path: '/quick-translator',
    badge: 'Đang phát triển',
  },
  {
    id: 'ttc-uploader',
    icon: <Upload size={36} strokeWidth={1.5} />,
    name: 'TTC Uploader',
    description: 'Đăng chương hàng loạt lên tiemtruyenchu.com. Resync chương từ folder truyện trong máy.',
    path: '/ttc-uploader',
    badge: 'Desktop',
    desktopOnly: true,
  },
];

export default function HomePage() {
  const isDesktop = isTauri();
  const visibleTools = isDesktop ? tools : tools.filter((t) => !t.desktopOnly);
  return (
    <div className="w-full mx-auto px-4 md:px-6 py-8 md:py-12">
      {/* Hero */}
      <div
        className="text-center mb-10 md:mb-14"
        style={{ animation: 'fadeIn 0.6s ease-out' }}
      >
        <h1 className="text-3xl md:text-4xl font-bold text-gold mb-3 tracking-wide">
          NovelKit
        </h1>
        <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-lg mx-auto">
          Bộ công cụ mã nguồn mở hỗ trợ converter truyện Trung Quốc.
          <br />
          <span className="text-text-dim text-sm">Chạy 100% trên trình duyệt — không cần cài đặt.</span>
        </p>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        {visibleTools.map((tool, i) => (
          <Link
            key={tool.id}
            to={tool.path}
            id={`tool-${tool.id}`}
            className="group relative block bg-bg-card border border-border-main rounded-xl p-5 md:p-6 transition-all duration-300 hover:border-border-gold hover:shadow-[0_8px_40px_rgba(0,0,0,0.6),0_0_20px_rgba(212,165,116,0.15)] hover:-translate-y-1 active:scale-[0.98]"
            style={{ animation: `slideUp 0.5s ease-out ${i * 0.1}s both` }}
          >
            {tool.badge && (
              <span className="absolute top-3 right-3 bg-gold-dim text-gold text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {tool.badge}
              </span>
            )}
            <div className="text-3xl md:text-4xl mb-3">{tool.icon}</div>
            <h2 className="text-lg md:text-xl font-semibold text-text-primary group-hover:text-gold transition-colors duration-300 mb-1.5">
              {tool.name}
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              {tool.description}
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-text-dim group-hover:text-gold transition-colors duration-300">
              <span>Mở tool</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </Link>
        ))}

        {/* Coming Soon placeholder */}
        <div
          className="block bg-bg-card/50 border border-border-main/50 rounded-xl p-5 md:p-6 opacity-50 cursor-default"
          style={{ animation: 'slideUp 0.5s ease-out 0.1s both' }}
        >
          <div className="mb-3 opacity-40"><Sparkles size={36} strokeWidth={1.5} /></div>
          <h2 className="text-lg md:text-xl font-semibold text-text-dim mb-1.5">
            Sắp ra mắt...
          </h2>
          <p className="text-sm text-text-dim leading-relaxed">
            Các tool hữu ích khác đang được phát triển.
          </p>
        </div>
      </div>
    </div>
  );
}
