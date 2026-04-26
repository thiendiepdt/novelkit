import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ScrollToTop, Header, Footer, Sidebar, StatusBar } from '@/shared/components';
import { isTauri } from '@/shared/utils/platform';
import HomePage from '@/features/home/HomePage';
import TextFormatterPage from '@/features/text-formatter/TextFormatterPage';
import TranslatorPage from '@/features/translator/TranslatorPage';
import ChapterSplitterPage from '@/features/chapter-splitter/ChapterSplitterPage';
import TtcUploaderPage from '@/features/ttc-uploader/TtcUploaderPage';
import DownloadsPage from '@/features/downloads/DownloadsPage';
import { DownloadQueueProvider } from '@/shared/context/DownloadQueueContext';
import { UploadQueueProvider } from '@/shared/context/UploadQueueContext';
import { SettingsProvider } from '@/features/settings/context/SettingsContext';
import { SettingsPage } from '@/features/settings/SettingsPage';

function App() {
  // ─── Auto-update check (desktop only) ──────────────────
  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const { ask, message } = await import('@tauri-apps/plugin-dialog');
        const update = await check();
        if (update) {
          const yes = await ask(
            `Phiên bản mới ${update.version} đã có! Bạn có muốn cập nhật ngay không?`,
            { title: 'Cập nhật NovelKit', kind: 'info' }
          );
          if (yes) {
            await update.downloadAndInstall();
            await message('Cập nhật hoàn tất. Ứng dụng sẽ khởi động lại.', {
              title: 'Cập nhật thành công',
            });
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
          }
        }
      } catch (e) {
        console.warn('Update check failed:', e);
      }
    })();
  }, []);

  const routes = (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/text-formatter" element={<TextFormatterPage />} />
      <Route path="/chapter-splitter" element={<ChapterSplitterPage />} />
      <Route path="/quick-translator" element={<TranslatorPage />} />
      <Route path="/ttc-uploader" element={<TtcUploaderPage />} />
      <Route path="/downloads" element={<DownloadsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );

  if (isTauri()) {
    return (
      <SettingsProvider>
        <UploadQueueProvider>
          <DownloadQueueProvider>
            <BrowserRouter>
              <ScrollToTop />
              <div className="flex flex-col h-screen overflow-hidden bg-bg-main">
                <Header />
                <div className="flex flex-1 overflow-hidden">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto">
                    {routes}
                  </main>
                </div>
                <StatusBar />
              </div>
            </BrowserRouter>
          </DownloadQueueProvider>
        </UploadQueueProvider>
      </SettingsProvider>
    );
  }

  return (
    <SettingsProvider>
      <UploadQueueProvider>
        <DownloadQueueProvider>
          <BrowserRouter>
          <ScrollToTop />
          <div className="flex flex-col min-h-screen bg-bg-main">
            <Header />
            <main className="flex-1">
              {routes}
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </DownloadQueueProvider>
      </UploadQueueProvider>
    </SettingsProvider>
  );
}

export default App;
