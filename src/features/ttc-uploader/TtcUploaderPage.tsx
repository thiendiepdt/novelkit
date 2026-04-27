import { useState, useCallback } from 'react';
import { isTauri } from '@/shared/utils/platform';
import { useTtcAuth } from './hooks/useTtcAuth';
import { useTtcBooks } from './hooks/useTtcBooks';
import { useTtcChapters } from './hooks/useTtcChapters';
import {
  LoginView,
  BookCard,
  BookListToolbar,
  BookDetailHeader,
  UploadToolbar,
  ChapterTable,
  ResyncComparisonTable,
  DownloadAllModal,
  EditBookModal,
} from './components';
import type { TtcStory } from './types';

export default function TtcUploaderPage() {
  // ─── Gate: desktop only ────────────────────────────────
  if (!isTauri()) {
    return (
      <div className="w-full mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-4">🖥️</div>
        <h1 className="text-2xl font-bold text-gold mb-2">Chỉ dành cho Desktop</h1>
        <p className="text-text-secondary">
          Tính năng TTC Uploader chỉ khả dụng trên phiên bản desktop của NovelKit.
        </p>
      </div>
    );
  }

  return <TtcUploaderContent />;
}

function TtcUploaderContent() {
  // ─── Hooks ──────────────────────────────────────────────
  const auth = useTtcAuth();
  const books = useTtcBooks(auth.session);
  const [selectedBook, setSelectedBook] = useState<TtcStory | null>(null);
  const chapters = useTtcChapters(selectedBook);

  // ─── Modal state ────────────────────────────────────────
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [showDownloadAllModal, setShowDownloadAllModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'remote' | 'local'>('remote');

  // ─── Book selection handlers ────────────────────────────
  const handleSelectBook = useCallback((book: TtcStory) => {
    setSelectedBook(book);
    chapters.resetState();
    setActiveTab('remote');
    chapters.fetchRemoteChapters(book.id, 1, chapters.chaptersLimit);
  }, [chapters]);

  const handleBackToList = useCallback(() => {
    setSelectedBook(null);
    chapters.resetState();
  }, [chapters]);

  const handleLogout = useCallback(async () => {
    await auth.handleLogout();
    setSelectedBook(null);
    chapters.resetState();
  }, [auth, chapters]);

  // ─── Loading state ──────────────────────────────────────
  if (auth.checkingSession) {
    return (
      <div className="w-full mx-auto px-4 py-12 text-center">
        <div className="text-text-dim">Đang kiểm tra phiên đăng nhập...</div>
      </div>
    );
  }

  // ─── WORK VIEW: Resync a selected book ──────────────────
  if (selectedBook) {
    return (
      <div className="w-full h-full flex flex-col mx-auto px-4 md:px-6 py-4 md:py-6 overflow-hidden">
        <div className="flex-shrink-0 flex flex-col gap-4">
          <BookDetailHeader book={selectedBook} onBack={handleBackToList} />
          <UploadToolbar
            folderPath={chapters.folderPath}
            chapters={chapters.chapters}
            loadingChapters={chapters.loadingChapters}
            syncMode={chapters.syncMode}
            fromIndex={chapters.fromIndex}
            toIndex={chapters.toIndex}
            delayMs={chapters.delayMs}
            progress={chapters.progress}
            onPickFolder={chapters.handlePickFolder}
            onReloadFolder={chapters.handleReloadFolder}
            onSyncModeChange={chapters.setSyncMode}
            onFromIndexChange={chapters.setFromIndex}
            onToIndexChange={chapters.setToIndex}
            onDelayChange={chapters.setDelayMs}
            enableSplit={chapters.enableSplit}
            splitFromChapter={chapters.splitFromChapter}
            maxWords={chapters.maxWords}
            minWords={chapters.minWords}
            roundUp={chapters.roundUp}
            localSortMode={chapters.localSortMode}
            chapterPrice={chapters.chapterPrice}
            unlockTimer={chapters.unlockTimer}
            vipNewChaptersOnly={chapters.vipNewChaptersOnly}
            onEnableSplitChange={chapters.setEnableSplit}
            onSplitFromChapterChange={chapters.setSplitFromChapter}
            onMaxWordsChange={chapters.setMaxWords}
            onMinWordsChange={chapters.setMinWords}
            onRoundUpChange={chapters.setRoundUp}
            onLocalSortModeChange={chapters.setLocalSortMode}
            onChapterPriceChange={chapters.setChapterPrice}
            onUnlockTimerChange={chapters.setUnlockTimer}
            onVipNewChaptersOnlyChange={chapters.setVipNewChaptersOnly}
            onUpload={chapters.handleUpload}
            onCancelUpload={chapters.handleCancelUpload}
            onRemoveJob={chapters.handleRemoveJob}
          />
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex items-center gap-2 border-b border-border-main pb-[1px] mt-2">
          <button
            onClick={() => setActiveTab('remote')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'remote'
                ? 'bg-bg-card border border-border-main border-b-bg-card text-gold relative top-[1px]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            📋 Danh sách TTC
          </button>
          <button
            onClick={() => {
              setActiveTab('local');
              if (chapters.allRemoteChapters.length === 0 && !chapters.loadingAllRemote) {
                chapters.fetchAllRemoteChapters(selectedBook.id);
              }
            }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'local'
                ? 'bg-bg-card border border-border-main border-b-bg-card text-gold relative top-[1px]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            ⚖️ So sánh Local
            {chapters.loadingAllRemote && <span className="ml-1.5 text-[10px] text-text-dim animate-pulse">(đang tải...)</span>}
          </button>
        </div>

        {activeTab === 'remote' ? (
          <ChapterTable
            selectedBook={selectedBook}
            chapters={chapters.remoteChapters}
            currentPage={chapters.remoteChapPage}
            totalPages={chapters.remoteChapTotalPages}
            totalChapters={chapters.remoteChapTotal}
            loading={chapters.loadingRemoteChaps}
            chaptersLimit={chapters.chaptersLimit}
            onPageChange={(bookId, page, limit) => chapters.fetchRemoteChapters(bookId, page, limit)}
            onLimitChange={(newLimit) => {
              chapters.setChaptersLimit(newLimit);
              chapters.fetchRemoteChapters(selectedBook.id, 1, newLimit);
            }}
            onRefresh={() => chapters.fetchRemoteChapters(selectedBook.id, chapters.remoteChapPage, chapters.chaptersLimit)}
            onDownloadChapter={chapters.handleDownloadChapter}
            onDownloadAll={() => setShowDownloadAllModal(true)}
          />
        ) : (
          <ResyncComparisonTable
            remoteChapters={chapters.allRemoteChapters}
            localChapters={chapters.chapters}
            loading={chapters.loadingAllRemote}
            onAutoSelectMode={(mode, fromIndex, toIndex) => {
              chapters.setSyncMode(mode);
              if (fromIndex !== undefined) chapters.setFromIndex(fromIndex);
              if (toIndex !== undefined) chapters.setToIndex(toIndex);
            }}
          />
        )}

        {/* Download All Modal */}
        {showDownloadAllModal && (
          <DownloadAllModal
            book={selectedBook}
            onClose={() => setShowDownloadAllModal(false)}
          />
        )}
      </div>
    );
  }

  // ─── LIST VIEW: Login + Book list ───────────────────────
  return (
    <div className="w-full h-full flex flex-col mx-auto px-4 md:px-6 py-4 md:py-6 overflow-hidden">
      {/* Header & Login */}
      {!auth.session ? (
        <LoginView onLogin={auth.handleLogin} />
      ) : (
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3" style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <span className="text-2xl">📤</span>
            <h1 className="text-xl md:text-2xl font-bold text-gold">
              TTC Uploader
            </h1>
            <span className="bg-purple/20 text-purple text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block">
              Desktop
            </span>
          </div>

          <div
            className="bg-bg-card border border-border-main rounded-xl px-4 py-2 flex items-center gap-4"
            style={{ animation: 'slideUp 0.4s ease-out' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-jade" />
              <span className="text-xs font-medium text-text-primary">
                Đã đăng nhập TiemTruyenChu
              </span>
            </div>
            <div className="w-px h-4 bg-border-main"></div>
            <button
              onClick={handleLogout}
              className="text-xs text-text-dim hover:text-crimson transition-colors cursor-pointer font-medium"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      )}

      {/* Books List */}
      {auth.session && (
        <div className="flex flex-col flex-1 min-h-0" style={{ animation: 'slideUp 0.4s ease-out 0.1s both' }}>
          <BookListToolbar
            totalStories={books.totalStories}
            loadingBooks={books.loadingBooks}
            searchKeyword={books.searchKeyword}
            statusFilter={books.statusFilter}
            currentPage={books.currentPage}
            totalPages={books.totalPages}
            booksLimit={books.booksLimit}
            onSearchChange={books.handleSearchChange}
            onStatusToggle={books.handleStatusToggle}
            onPageChange={books.setCurrentPage}
            onLimitChange={(newLimit) => {
              books.setBooksLimit(newLimit);
              books.setCurrentPage(1);
              books.fetchBooks(1, books.searchKeyword, books.statusFilter.join(','), newLimit);
            }}
            onRefresh={books.refreshBooks}
          />

          {books.booksError && (
            <div className="bg-crimson/10 border border-crimson/30 rounded-lg p-3 mb-3 text-sm text-crimson">
              {books.booksError}
            </div>
          )}

          {/* Book Cards */}
          <div className="flex-1 overflow-y-auto pr-2 min-h-0">
            <div className="grid gap-2">
              {books.books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onEdit={setEditingBookId}
                  onResync={handleSelectBook}
                />
              ))}

              {books.books.length === 0 && !books.loadingBooks && (
                <div className="text-center py-8 text-text-dim text-sm">
                  {books.searchKeyword
                    ? `Không tìm thấy truyện nào cho "${books.searchKeyword}"`
                    : 'Không có truyện nào.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {editingBookId && (
        <EditBookModal
          bookId={editingBookId}
          onClose={() => setEditingBookId(null)}
          onSuccess={() => {
            setEditingBookId(null);
            books.refreshBooks();
          }}
        />
      )}
    </div>
  );
}
