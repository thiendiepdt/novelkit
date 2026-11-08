import { useEffect, useState } from 'react';
import { isTauri } from '@/shared/utils/platform';
import { SettingsItem, SettingsText } from './SettingsItem';

type TokenSource = 'settings' | 'env' | 'none';

const SOURCE_TEXT: Record<TokenSource, { text: string; className: string }> = {
  settings: { text: 'Đang dùng token nhập ở đây.', className: 'text-jade' },
  env: { text: 'Ô trống: đang dùng token từ biến môi trường MEOTRUYEN_TOKEN.', className: 'text-jade' },
  none: { text: 'Chưa có token: nhập ở đây hoặc đặt biến môi trường MEOTRUYEN_TOKEN.', className: 'text-crimson' },
};

/** The uploader token of meotruyen.com ("Đăng lên Mèo Truyện" in TTC Uploader). */
export function MeoTruyenSettingsSection({ token, onChange }: { token: string; onChange: (token: string) => void }) {
  const [source, setSource] = useState<TokenSource | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    // Asked of Rust, which reads the environment; the token itself never comes back.
    import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke<TokenSource>('meotruyen_token_source', { token }))
      .then((s) => !cancelled && setSource(s))
      .catch(() => !cancelled && setSource(null));
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-medium text-text-primary mb-2 border-b border-border-main pb-2">Mèo Truyện</h3>

      <div className="p-3 bg-bg-hover/50 rounded-xl border border-border-main text-xs text-text-secondary">
        Dùng cho nút <strong className="text-gold">Mèo Truyện</strong> ở các truyện nữ trong TTC Uploader: nạp truyện cùng các
        chương trong folder lên meotruyen.com thành bản nháp. Token chỉ được gửi tới https://meotruyen.com và chỉ lưu trên máy này.
      </div>

      <SettingsItem
        label="Token nạp truyện"
        description='Tạo ở trang "Token nạp truyện" trong khu quản trị Mèo Truyện (dạng mtk_…). Để trống để dùng biến môi trường MEOTRUYEN_TOKEN.'
      >
        <SettingsText value={token} onChange={(v) => onChange(v.trim())} placeholder="mtk_..." secret />
      </SettingsItem>

      {source && <p className={`px-4 text-xs ${SOURCE_TEXT[source].className}`}>{SOURCE_TEXT[source].text}</p>}
    </div>
  );
}
