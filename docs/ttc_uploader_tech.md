# TTC Uploader — Technical Documentation

> Desktop-only feature for managing books and chapters on TiemTruyenChu (TTC) — a Vietnamese web novel platform.

## Overview

TTC Uploader provides a desktop GUI to:
- **Authenticate** with TTC via cookie-based session (opens a real login webview)
- **Browse** your book library with search, status filters, and pagination
- **Edit** book metadata (title, author, category, status, cover image)
- **Upload** chapters from local `.txt` files (all, append, or range modes)
- **Download** individual chapters or entire books (single file, chunked, or per-chapter)

This feature is **gated to Tauri desktop only** — the web build shows a "desktop only" placeholder.

## Architecture

```
src/features/ttc-uploader/
├── TtcUploaderPage.tsx          # Thin orchestrator (~200 lines)
├── api.ts                       # HTML form parsing & submission helpers
├── types.ts                     # TypeScript interfaces
├── constants.ts                 # Status options, pagination defaults
├── hooks/
│   ├── useTtcAuth.ts            # Session check, login polling, logout
│   ├── useTtcBooks.ts           # Book list, search, filters, pagination
│   └── useTtcChapters.ts        # Chapter list, folder parsing, upload, download
├── components/
│   ├── index.ts                 # Barrel export
│   ├── LoginView.tsx            # Unauthenticated landing screen
│   ├── BookCard.tsx             # Individual book card
│   ├── BookListToolbar.tsx      # Search + status filters + pagination
│   ├── BookDetailHeader.tsx     # Book detail header with back button
│   ├── UploadToolbar.tsx        # Folder picker + sync mode + progress
│   ├── ChapterTable.tsx         # Remote chapter list table
│   ├── DownloadAllModal.tsx     # Full-book download settings modal
│   ├── EditBookModal.tsx        # Book metadata editor modal
│   ├── CoverCropperModal.tsx    # Image cropper for cover upload
│   └── ProxiedImage.tsx         # CORS-bypassing poster image
└── utils/
    └── cropImage.ts             # Canvas-based image cropping utility
```

## Rust Backend (`src-tauri/src/ttc/`)

The TTC backend is structured into domain-focused modules:

```
src-tauri/src/ttc/
├── mod.rs          # Module declarations
├── types.rs        # Serde structs for API payloads & responses
├── client.rs       # Shared reqwest::Client + session helper
├── session.rs      # Session state, persistence, login commands
├── image.rs        # Image proxy with in-memory cache
├── books.rs        # Book CRUD: fetch list, HTML forms, cover upload
├── chapters.rs     # Chapter commands: fetch, parse, upload, download
└── utils.rs        # OS file manager opener, filename sanitization
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Shared `TtcClient`** | Single `reqwest::Client` managed as Tauri state → connection pooling instead of one-off clients |
| **`get_session()` helper** | Eliminates 8+ copies of `state.cookie.lock().unwrap().clone().ok_or(...)` |
| **`base64` crate** | Replaces 24-line hand-rolled base64 encoder with battle-tested crate |
| **Image cache in-memory** | `TtcImageCache` (HashMap) prevents re-fetching poster images on navigation |
| **Session on disk** | `ttc_session.dat` in app data dir persists login across app restarts |

### Command Reference

| Command | Module | Description |
|---------|--------|-------------|
| `ttc_open_login` | session | Open TTC login webview window |
| `ttc_check_session` | session | Extract session cookie from login webview |
| `ttc_get_session` | session | Return current session from state |
| `ttc_logout` | session | Clear session from state + disk |
| `ttc_verify_session` | session | Check if session is still valid via API |
| `ttc_fetch_books` | books | Fetch paginated book list with filters |
| `ttc_fetch_html` | books | Fetch authenticated HTML page |
| `ttc_submit_multipart` | books | Submit multipart form (book edit) |
| `ttc_upload_cover` | books | Upload cropped cover image |
| `ttc_fetch_chapters` | chapters | Fetch paginated chapter list |
| `ttc_parse_chapters` | chapters | Parse `.txt` files from a local folder |
| `ttc_upload_chapters` | chapters | Upload chapters with progress events |
| `ttc_download_chapter` | chapters | Download single chapter content |
| `ttc_download_all_chapters` | chapters | Download all chapters with multi-threading |
| `ttc_proxy_image` | image | Fetch poster image via Rust to bypass CORS |
| `ttc_read_local_file` | image | Read a local file as bytes |
| `ttc_open_folder` | utils | Open folder in OS file manager |

## Hook API

### `useTtcAuth()`
Returns: `{ session, checkingSession, handleLogin, handleLogout }`

### `useTtcBooks(session)`
Returns: `{ books, loadingBooks, booksError, searchKeyword, statusFilter, currentPage, totalPages, totalStories, booksLimit, ... }`

### `useTtcChapters(selectedBook)`
Returns: `{ remoteChapters, chapters, folderPath, progress, syncMode, handleUpload, handleCancelUpload, handleRemoveJob, ... }`

> Note: `useTtcChapters` no longer manages upload progress locally. It delegates to `UploadQueueContext` (see below) and derives `progress` from the active job for the current book.

## Upload Queue (`shared/context/UploadQueueContext`)

Background upload queue that allows users to enqueue multiple books for sequential chapter upload without blocking the UI.

### Architecture

```
Header
  └── UploadQueueManager (dropdown UI)
        ↕ reads/writes
UploadQueueContext (React context, wraps entire app)
  ├── jobs: UploadJob[]
  ├── processNextJob() → invoke('ttc_upload_chapters', { options, jobId })
  ├── listen('ttc://upload-progress') → update job.progress
  ├── notifyUser() → @tauri-apps/plugin-notification (desktop) / Web Notification API
  └── cancelJob() → emit('ttc://cancel-upload-{jobId}')
```

### Key design decisions

| Decision | Rationale |
|----------|-----------|
| **Sequential processing** | Only one upload runs at a time to avoid TTC rate-limiting (HTTP 429) |
| **job_id in Rust events** | Each `UploadProgressEvent` carries `job_id` so the frontend can route events to the correct job |
| **Cancellation via event** | Frontend emits `ttc://cancel-upload-{jobId}`, Rust listens with `AtomicBool` flag and checks it during delays |
| **Native notifications** | Uses `tauri-plugin-notification` on desktop, Web Notification API on web — fires on job completion or error |
| **Types split** | `UploadProgressEvent` (Rust event shape with `job_id`) vs `UploadProgress` (UI-facing shape with `'idle'`/`'pending'` states) |

### Related files

| File | Purpose |
|------|---------|
| `shared/context/uploadQueueDefs.ts` | `UploadJob` interface |
| `shared/context/UploadQueueContext.tsx` | Provider, queue logic, notifications |
| `shared/components/UploadQueueManager.tsx` | Header dropdown UI for the queue |

## Data Flow

```
Login Flow:
  useTtcAuth.handleLogin()
    → invoke('ttc_open_login')     → Opens webview
    → poll invoke('ttc_check_session') every 2s
    → Session cookie extracted → stored in TtcSession + disk

Upload Flow (Queue-based):
  useTtcChapters.handlePickFolder()
    → Tauri dialog → invoke('ttc_read_folder_text')
    → ParsedChapter[] rendered in UI
  useTtcChapters.handleUpload()
    → addJob(options, bookTitle) into UploadQueueContext
    → UploadQueueContext.processNextJob()
      → invoke('ttc_upload_chapters', { options, jobId })
      → Backend emits 'ttc://upload-progress' events with job_id
      → Context updates matching job's progress
    → On completion/error: native notification + status update
    → Next pending job auto-starts

  Cancel: handleCancelUpload()
    → emit('ttc://cancel-upload-{jobId}')
    → Rust AtomicBool flag checked during delays → returns Err

Download All Flow:
  DownloadAllModal → addJob(options)
    → DownloadQueueContext processes queue
    → invoke('ttc_download_all_chapters', { options, jobId })
    → Backend emits 'ttc://download-all-progress' events
    → Cancel via 'ttc://cancel-download-{jobId}' event
```

## Known Limitations

1. **Session expiry**: No auto-refresh — user must re-login when session expires
2. **Chapter parsing**: Only detects "Chương N:" heading format
3. **Cover crop**: Uses canvas-based cropping (no rotation support in output)
4. **Download ordering**: Multi-threaded downloads may write chunks out-of-order for "single" mode
5. **Upload queue is in-memory only**: Pending jobs are lost on app restart

