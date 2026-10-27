import { useState, useCallback } from 'react';
import { isTauri } from '@/shared/utils/platform';
import { Monitor, Scale, Upload, ClipboardList, AlertTriangle } from 'lucide-react';
import { useTtcAuth } from './hooks/useTtcAuth';
import type { TtcAuth } from './hooks/useTtcAuth';
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
  CreateBookModal,
  DeleteBookModal,
  AccountSwitcher,
} from './components';
import { accountLabel } from './utils/accountLabel';
import type { TtcAccountInfo, TtcStory } from './types';

export default function TtcUploaderPage() {
  // ─── Gate: desktop only ────────────────────────────────
  if (!isTauri()) {
    return (
      <div className="w-full mx-auto px-4 py-12 text-center">
        <div className="flex justify-center mb-4 text-text-dim"><Monitor size={48} /></div>
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
  const auth = useTtcAuth();

  if (auth.checkingSession) {
    return (
      <div className="w-full mx-auto px-4 py-12 text-center">
        <div className="text-text-dim">Đang kiểm tra phiên đăng nhập...</div>
      </div>
    );
  }

  if (!auth.active) {
    return (
      <div className="w-full h-full flex flex-col mx-auto px-4 md:px-6 py-4 md:py-6 overflow-hidden">
        <LoginView onLogin={auth.addAccount} />
        {auth.loggingIn && (
          <p className="text-center text-xs text-text-dim mt-3">Đang chờ đăng nhập trong cửa sổ TiemTruyenChu...</p>
        )}
      </div>
    );
  }

  // One workspace per account: switching remounts it, so the open book, the modals and any
  // request still running for the previous account are all dropped.
  return <TtcWorkspace key={auth.active.username} auth={auth} account={auth.active} />;
}

function TtcWorkspace({ auth, account }: { auth: TtcAuth; account: TtcAccountInfo }) {
  // ─── Hooks ──────────────────────────────────────────────
  const books = useTtcBooks(account.username);
  const [selectedBook, setSelectedBook] = useState<TtcStory | null>(null);
  const chapters = useTtcChapters(selectedBook, account.username);

  // ─── Modal state ────────────────────────────────────────
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingBook, setDeletingBook] = useState<TtcStory | null>(null);
  /** Outcome of the last create/delete, shown above the list until dismissed. */
  const [listNotice, setListNotice] = useState<string | null>(null);
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
            fileFirstLineTitle={chapters.fileFirstLineTitle}
            chapterPrice={chapters.chapterPrice}
            unlockTimer={chapters.unlockTimer}
            vipMinWords={chapters.vipMinWords}
            vipFromChapter={chapters.vipFromChapter}
            skipChapters={chapters.skipChapters}
            onEnableSplitChange={chapters.setEnableSplit}
            onSplitFromChapterChange={chapters.setSplitFromChapter}
            onMaxWordsChange={chapters.setMaxWords}
            onMinWordsChange={chapters.setMinWords}
            onRoundUpChange={chapters.setRoundUp}
            onLocalSortModeChange={chapters.setLocalSortMode}
            onFileFirstLineTitleChange={chapters.setFileFirstLineTitle}
            onChapterPriceChange={chapters.setChapterPrice}
            onUnlockTimerChange={chapters.setUnlockTimer}
            onVipMinWordsChange={chapters.setVipMinWords}
            onVipFromChapterChange={chapters.setVipFromChapter}
            onSkipChaptersChange={chapters.setSkipChapters}
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
            <ClipboardList size={16} className="inline mr-1 -mt-0.5" /> Chương trên TTC
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
            <Scale size={16} className="inline mr-1 -mt-0.5" /> So sánh & Upload
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
            account={account.username}
            onClose={() => setShowDownloadAllModal(false)}
          />
        )}
      </div>
    );
  }

  // ─── LIST VIEW: Login + Book list ───────────────────────
  return (
    <div className="w-full h-full flex flex-col mx-auto px-4 md:px-6 py-4 md:py-6 overflow-hidden">
      {/* Header & account */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <span className="flex items-center text-gold"><Upload size={28} /></span>
          <h1 className="text-xl md:text-2xl font-bold text-gold">
            TTC Uploader
          </h1>
          <span className="bg-purple/20 text-purple text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block">
            Desktop
          </span>
        </div>

        <div style={{ animation: 'slideUp 0.4s ease-out' }}>
          <AccountSwitcher
            accounts={auth.accounts}
            active={account}
            busy={auth.switching || auth.loggingIn}
            onSwitch={auth.switchAccount}
            onAdd={auth.addAccount}
            onLogout={auth.logout}
          />
        </div>
      </div>

      {auth.loggingIn && (
        <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 mb-3 text-sm text-gold">
          Đang chờ đăng nhập trong cửa sổ TiemTruyenChu. Tài khoản mới sẽ được thêm và chọn ngay khi đăng nhập xong.
        </div>
      )}

      {account.needsLogin && (
        <div className="bg-crimson/10 border border-crimson/30 rounded-lg p-3 mb-3 text-sm text-crimson flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            Phiên đăng nhập của {accountLabel(account)} đã hết hạn. Hãy đăng nhập lại tài khoản này.
          </span>
          <button
            onClick={auth.addAccount}
            className="text-xs font-bold bg-crimson text-white px-3 py-1.5 rounded-lg hover:bg-crimson/90 cursor-pointer whitespace-nowrap"
          >
            Đăng nhập lại
          </button>
        </div>
      )}

      {auth.error && (
        <div className="bg-crimson/10 border border-crimson/30 rounded-lg p-3 mb-3 text-sm text-crimson flex items-center justify-between gap-3">
          <span>{auth.error}</span>
          <button onClick={auth.clearError} aria-label="Ẩn lỗi" className="text-crimson/70 hover:text-crimson cursor-pointer">✕</button>
        </div>
      )}

      {/* Books List */}
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
            onCreate={() => setShowCreateModal(true)}
          />

          {listNotice && (
            <div className="bg-jade/10 border border-jade/30 rounded-lg p-3 mb-3 text-sm text-jade flex items-center justify-between gap-3">
              <span>{listNotice}</span>
              <button
                onClick={() => setListNotice(null)}
                aria-label="Ẩn thông báo"
                className="text-jade/70 hover:text-jade cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

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
                  onDelete={setDeletingBook}
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

      {/* Create Book Modal */}
      {showCreateModal && (
        <CreateBookModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(result) => {
            setShowCreateModal(false);
            setListNotice(`Đã đăng truyện “${result.title}”. Bấm Đồng bộ ở truyện đó để upload chương.`);
            books.refreshBooks();
          }}
        />
      )}

      {/* Delete (pending) Book Modal */}
      {deletingBook && (
        <DeleteBookModal
          book={deletingBook}
          onClose={() => setDeletingBook(null)}
          onDeleted={(book, message) => {
            setDeletingBook(null);
            // TTC reports through a flash message; when it sends none, the refreshed list is the proof.
            setListNotice(
              message ?? `Đã gửi yêu cầu xóa truyện “${book.title}”. TTC không trả thông báo, hãy kiểm tra danh sách vừa làm mới.`,
            );
            books.refreshBooks();
          }}
        />
      )}
    </div>
  );
}
