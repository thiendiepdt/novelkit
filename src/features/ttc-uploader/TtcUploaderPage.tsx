import { useState, useCallback, useRef } from 'react';
import { isTauri } from '@/shared/utils/platform';
import { Monitor, Scale, Upload, ClipboardList, AlertTriangle } from 'lucide-react';
import { useTtcAuth } from './hooks/useTtcAuth';
import type { TtcAuth } from './hooks/useTtcAuth';
import { useTtcBooks } from './hooks/useTtcBooks';
import { useBookTabs } from './hooks/useBookTabs';
import { useTtcChapters } from './hooks/useTtcChapters';
import {
  LoginView,
  BookCard,
  BookListToolbar,
  BookListFilters,
  BookDetailHeader,
  UploadToolbar,
  ChapterTable,
  ResyncComparisonTable,
  DownloadAllModal,
  EditBookModal,
  CreateBookModal,
  DeleteBookModal,
  AbandonCheckModal,
  AccountSwitcher,
  SyncScanModal,
} from './components';
import { accountLabel } from './utils/accountLabel';
import { useDrip } from './drip';
import { DripBookControls, DripModal } from './components';
import { FolderSyncNote } from './components/FolderSyncNote';
import type { UploadMode } from './components/UploadToolbar';
import { useUploadQueueContext } from '@/shared/context/UploadQueueContext';
import { isPendingApproval } from './types';
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
  const tabs = useBookTabs(books.allBooks);
  // Pages of the current tab and sources, cut here: the list is loaded whole.
  const totalPages = Math.max(1, Math.ceil(tabs.visible.length / books.booksLimit));
  const currentPage = Math.min(books.currentPage, totalPages);
  const pageBooks = tabs.visible.slice((currentPage - 1) * books.booksLimit, currentPage * books.booksLimit);
  const listRef = useRef<HTMLDivElement>(null);
  const goToPage = (page: number) => {
    books.setCurrentPage(page);
    listRef.current?.scrollTo({ top: 0 });
  };
  const [selectedBook, setSelectedBook] = useState<TtcStory | null>(null);
  const chapters = useTtcChapters(selectedBook, account.username);
  const drip = useDrip();
  const uploadQueue = useUploadQueueContext();
  /** Mode picked for the open story; a story with a drip plan is always in drip mode. */
  const [modeChoice, setModeChoice] = useState<UploadMode>('now');
  const [showDrip, setShowDrip] = useState(false);

  // ─── Modal state ────────────────────────────────────────
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingBook, setDeletingBook] = useState<TtcStory | null>(null);
  /** Outcome of the last create/delete, shown above the list until dismissed. */
  const [listNotice, setListNotice] = useState<string | null>(null);
  const [showDownloadAllModal, setShowDownloadAllModal] = useState(false);
  const [showAbandonCheck, setShowAbandonCheck] = useState(false);
  const [showSyncScan, setShowSyncScan] = useState(false);
  const [activeTab, setActiveTab] = useState<'remote' | 'local'>('remote');

  // ─── Book selection handlers ────────────────────────────
  const handleSelectBook = useCallback((book: TtcStory) => {
    setSelectedBook(book);
    chapters.resetState();
    setModeChoice('now');
    setActiveTab('remote');
    chapters.fetchRemoteChapters(book.id, 1, chapters.chaptersLimit);
  }, [chapters]);

  const handleBackToList = useCallback(() => {
    setSelectedBook(null);
    chapters.resetState();
  }, [chapters]);


  // ─── WORK VIEW: Resync a selected book ──────────────────
  if (selectedBook) {
    const dripPlan = drip.snapshot?.plans.find((p) => p.bookId === selectedBook.id);
    const bookJob = uploadQueue.getJobForBook(selectedBook.id);
    const normalUploadBusy = !!bookJob && !bookJob.silent && (bookJob.status === 'pending' || bookJob.status === 'uploading');
    const uploadModeLock = dripPlan
      ? 'Truyện đang nổi bảng: bấm "Dừng hẳn" để quay về đăng ngay'
      : normalUploadBusy
        ? 'Truyện đang có tiến trình upload thường, chờ nó xong hoặc hủy nó trước'
        : null;
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
            uploadMode={dripPlan ? 'drip' : modeChoice}
            onUploadModeChange={setModeChoice}
            uploadModeLock={uploadModeLock}
            dripControls={
              <DripBookControls
                key={selectedBook.id}
                book={selectedBook}
                account={account.username}
                normalUploadBusy={normalUploadBusy}
              />
            }
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
            totalStories={books.allBooks.length}
            loadingBooks={books.loadingBooks}
            searchKeyword={books.searchKeyword}
            statusFilter={books.statusFilter}
            onSearchChange={books.handleSearchChange}
            onStatusToggle={books.handleStatusToggle}
            onRefresh={books.refreshBooks}
            onCreate={() => setShowCreateModal(true)}
            onCheckAbandon={() => setShowAbandonCheck(true)}
            onScanSync={() => setShowSyncScan(true)}
            onOpenDrip={() => setShowDrip(true)}
            dripRunning={drip.snapshot?.plans.filter((p) => p.status === 'running').length ?? 0}
            dripTotal={drip.snapshot?.plans.length ?? 0}
          />

          <BookListFilters
            tab={tabs.tab}
            counts={tabs.counts}
            onTabChange={(tab) => {
              tabs.setTab(tab);
              goToPage(1);
            }}
            unsynced={tabs.folderSync}
            sourceOptions={tabs.sourceOptions}
            sources={tabs.sources}
            onToggleSource={(name) => {
              tabs.toggleSource(name);
              goToPage(1);
            }}
            onClearSources={() => {
              tabs.clearSources();
              goToPage(1);
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            booksLimit={books.booksLimit}
            onPageChange={goToPage}
            onLimitChange={(newLimit) => {
              books.setBooksLimit(newLimit);
              goToPage(1);
            }}
            disabled={books.loadingBooks}
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
          <div ref={listRef} className="flex-1 overflow-y-auto pr-2 min-h-0">
            <div className="grid gap-2">
              {pageBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onEdit={setEditingBookId}
                  onResync={handleSelectBook}
                  onDelete={setDeletingBook}
                  dripStatus={drip.snapshot?.plans.find((p) => p.bookId === book.id)?.status}
                  note={tabs.tab === 'unsynced' ? <FolderSyncNote status={tabs.folderSync.statusOf(book.id)} /> : undefined}
                />
              ))}

              {pageBooks.length === 0 && !books.loadingBooks && (
                <div className="text-center py-8 text-text-dim text-sm">
                  {books.allBooks.length === 0 && books.searchKeyword
                    ? `Không tìm thấy truyện nào cho "${books.searchKeyword}"`
                    : books.allBooks.length === 0
                      ? 'Không có truyện nào.'
                      : tabs.tab === 'unsynced' && tabs.folderSync.checking
                        ? 'Chưa thấy truyện nào lệch với TTC, đang đọc tiếp các folder...'
                        : 'Không có truyện nào trong mục này.'}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Edit Book Modal */}
      {editingBookId && (
        <EditBookModal
          bookId={editingBookId}
          pending={books.allBooks.some((b) => b.id === editingBookId && isPendingApproval(b))}
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
            setListNotice(`Đã đăng truyện “${result.title}”. Bấm Quản lý chương ở truyện đó để upload chương.`);
            books.refreshBooks();
          }}
        />
      )}

      {/* Abandon ("vô hố") check: reup chapter 1 of ongoing stories */}
      {showAbandonCheck && (
        <AbandonCheckModal
          account={account.username}
          onClose={() => {
            setShowAbandonCheck(false);
            books.refreshBooks();
          }}
          onOpenBook={(book) => {
            setShowAbandonCheck(false);
            handleSelectBook(book);
          }}
        />
      )}

      {/* "Quét chương mới": stories whose folder is ahead of TTC */}
      {showSyncScan && (
        <SyncScanModal
          account={account.username}
          onClose={() => {
            setShowSyncScan(false);
            books.refreshBooks();
          }}
          onOpenBook={(book) => {
            setShowSyncScan(false);
            handleSelectBook(book);
          }}
        />
      )}

      {/* "Nổi trên bảng cập nhật": every drip plan and the shared interval */}
      {showDrip && (
        <DripModal
          account={account.username}
          onClose={() => setShowDrip(false)}
          onOpenBook={(bookId) => {
            const book = books.allBooks.find((b) => b.id === bookId);
            setShowDrip(false);
            if (book) handleSelectBook(book);
            else books.handleSearchChange(drip.snapshot?.plans.find((p) => p.bookId === bookId)?.bookTitle ?? '');
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
