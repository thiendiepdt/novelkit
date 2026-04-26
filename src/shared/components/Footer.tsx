export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: '1px solid rgba(201,169,110,0.1)',
        marginTop: '2rem',
      }}
    >
      <div className="w-full mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 text-gold text-sm font-semibold tracking-wide">
            <span>⚙</span>
            NovelKit
          </div>
          <p className="text-xs text-text-dim leading-relaxed max-w-md">
            Bộ công cụ mã nguồn mở hỗ trợ converter truyện Trung Quốc.
            Chạy 100% trên trình duyệt — không cần cài đặt.
          </p>
          <div
            style={{
              height: '1px',
              width: '80px',
              background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.3), transparent)',
            }}
          />
          <span className="text-xs text-text-dim">
            © {year} NovelKit — Open Source · MIT License
          </span>
        </div>
      </div>
    </footer>
  );
}
