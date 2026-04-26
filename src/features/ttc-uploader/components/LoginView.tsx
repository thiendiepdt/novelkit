interface LoginViewProps {
  onLogin: () => void;
}

/**
 * Unauthenticated landing screen with lock icon and login button.
 */
export function LoginView({ onLogin }: LoginViewProps) {
  return (
    <>
      <div className="flex-shrink-0 flex items-center gap-3 mb-8" style={{ animation: 'fadeIn 0.4s ease-out' }}>
        <span className="text-2xl">📤</span>
        <h1 className="text-xl md:text-2xl font-bold text-gold">
          TTC Uploader
        </h1>
        <span className="bg-purple/20 text-purple text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block">
          Desktop
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0">
        <div
          className="bg-bg-card border border-border-main rounded-xl p-8 max-w-md w-full text-center shadow-lg"
          style={{ animation: 'slideUp 0.4s ease-out' }}
        >
          <div className="w-16 h-16 bg-bg-hover rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Chưa đăng nhập</h2>
          <p className="text-sm text-text-secondary mb-6">
            Bạn cần đăng nhập vào TiemTruyenChu để xem danh sách truyện và sử dụng tính năng upload hàng loạt.
          </p>
          <button
            onClick={onLogin}
            className="w-full py-2.5 bg-gold text-bg-primary font-bold text-sm rounded-lg hover:bg-gold/90 transition-colors cursor-pointer shadow-[0_0_15px_rgba(201,169,110,0.3)] hover:shadow-[0_0_20px_rgba(201,169,110,0.5)]"
          >
            Đăng nhập ngay
          </button>
        </div>
      </div>
    </>
  );
}
