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
| **Stop on first failed batch** | A rejected batch (TTC `success:false`, non-2xx, or network error) aborts the job: Rust emits a final `status: "error"` event and returns `Err("Chương a–b: <TTC server message>")`. The queue stores it as `job.error`, which `UploadQueueManager`, `UploadToolbar` and the native notification all display, so the user sees *why* the upload stopped |

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
    → Tauri dialog → invoke('ttc_read_folder_files') → FolderFile[] (name + text)
    → Sort "Tên chương"/"Thứ tự file": files joined and split on "Chương X" headings
    → Sort "Thứ tự file" + "Dòng đầu = tên chương": each file is one chapter,
      first non-empty line is the title (splitFilesByFirstLine)
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

## Create Story + AI Fill

"Đăng truyện mới" on the book list opens `CreateBookModal`, a port of the `/dang-truyen` form on TTC. The **AI fill** needs only the source link (a book page or, where the site allows it, a chapter page): everything else is read from the source site and translated by the configured model.

### Flow

```
CreateBookModal → useCreateBook
  load:    ttc_fetch_html('/dang-truyen') → parseCreateBookPage()
             → csrf token, option lists (category + 3 sub_categories), display name, posting rules
  AI fill: detectSource(link)                      (sources/detect.ts — Fanqie / QQ / Qidian / Qimao / SFACG / Faloo / JJWXC / Ciweimao)
             ?? detectChapterLookup(link)          (chapter-only link: fetch the chapter page for the book id)
             → source_fetch_text(fetchUrl)         (Rust, allowlisted hosts)
             (+ extraFetchUrl, best effort)        (SFACG: tags live on a second page)
             → parse{Fanqie,Qidian,Qq,Qimao,Sfacg,Faloo,Jjwxc,Ciweimao} → SourceBook
             → fills chinese_title, chinese_link (canonical), author_original
             → source_fetch_image(coverUrls…)      (background; pending cover, kept in memory)
             → buildFillPrompt() → ai_generate_json (Rust) → parseFillResponse()
             → fills title, author, gender, category, sub_categories, description
  submit:  buildCreateBookFields() → ttc_create_story → { success, message, redirectUrl }
             → bookIdFromRedirect(redirectUrl) → ttc_upload_cover(bookId, pending cover)
```

### Sources

| Source | Link forms accepted | Metadata is read from | Signing |
|--------|--------------------|-----------------------|---------|
| Fanqie | `fanqienovel.com/page/{id}`, share links with `book_id=` | `window.__INITIAL_STATE__` in the book page | none |
| QQ Reading | any `*.qq.com` book page (bid or `1e9 + bid`) | `detailadr.reader.qq.com/book/queryDetailPage` (public JSON) | none |
| Qidian | `qidian.com/{book,info,chapter}/{id}` on any subdomain | SSR page context of `m.qidian.com/book/{id}/` | none |
| Qimao | `qimao.com/shuku/{id}/`, chapter `shuku/{id}-{chapterId}/` | markup of the server-rendered book page (its `__NUXT__` state is a JS program, not data) | none |
| SFACG | `book.sfacg.com/Novel/{id}/[…chapter]`, `m.sfacg.com/{b,i}/{id}/`, chapter `m.sfacg.com/c/{chapterId}/` | `m.sfacg.com/b/{id}/` (full synopsis) + `book.sfacg.com/Novel/{id}/` (tags) | none |
| Faloo | `faloo.com/{id}.html`, chapter `{id}_{n}.html`, chapter list `html_{prefix}_{id}/` | `b.faloo.com/{id}.html`: Open Graph tags (declared with `name=`) + markup. **GB2312**, decoded in Rust | none |
| JJWXC | `onebook.php?novelid={id}[&chapterid=n]`, mobile `/book2/{id}[/{chapter}]`, on any `jjwxc*` domain | `app.jjwxc.net/androidapi/novelbasicinfo` (UTF-8 JSON; the web pages are GB18030 HTML) | none |
| Ciweimao | `{www,mip,wap}.ciweimao.com/book/{id}` | `www.ciweimao.com/book/{id}`: Open Graph tags + markup | none |

`www.qidian.com` answers HTTP 202 with a JS probe, so the mobile site is used; no signing worker is involved. A Fanqie chapter link (`/reader/{itemId}`) carries no book id and is rejected.

Chapter links are normalized to the book: most carry the book id in the path. `m.sfacg.com/c/{chapterId}/` does not, so `detectChapterLookup` + `sfacgBookIdFromChapter` read it from the back link of the chapter page (one extra fetch).

Non-UTF-8 pages: reqwest is built with its `charset` feature, so `Response::text` decodes by the charset in the `Content-Type` header (Faloo declares `gb2312`). A source that declares its charset only in a `<meta>` tag would still come out garbled; JJWXC is such a site, which is one reason its JSON endpoint is used instead.

JJWXC links are accepted on any `jjwxc*` domain (mirrors, renamed or dead domains): only the novel id is read from the link, and the request always goes to the allowlisted `app.jjwxc.net`.

www.qimao.com sends folded response headers (lines starting with a space), which hyper rejects by default; `ttc::client::build_http_client` enables `http1_allow_obsolete_multiline_headers_in_responses` for the shared client.

### Key design decisions

| Decision | Rationale |
|----------|-----------|
| **Fetch in Rust, parse in TS** | The webview cannot call the sites (CORS; WAFs reject a webview `Origin`). Parsing stays in TS where it is unit-tested against fixtures |
| **Host allowlists** | `source_fetch_text` only talks to the three metadata hosts and `source_fetch_image` to their CDNs, so neither is a general-purpose proxy |
| **Option lists from the live form** | Categories come from the TTC page, not a hardcoded list; the picks of the model are validated against them and anything else is dropped |
| **Model reply is untrusted** | `parseFillResponse` accepts bare / fenced / prose-wrapped JSON, title-cases names, and never throws on a bad category (it leaves the field for the user) |
| **Cover is pending until the story exists** | TTC uploads covers per story id, so the image is held in memory and uploaded right after `ttc_create_story`; a failed cover upload is reported without hiding that the story was created. The gateway of TTC sometimes answers the cover request with HTTP 504 after the story went through, so both `CreateBookModal` and `EditBookModal` keep the cropped image and offer "Thử lại tải ảnh bìa": only the cover request is repeated, never the create form |
| **Cover download tolerates a flaky CDN** | The cover CDNs (byteimg especially) can stall or drop a cold connection from outside mainland China. Each source yields ordered `coverUrls` (Fanqie: `…~tplv-shrink:640:0.image` first, `origin/…` as fallback; Ciweimao: the same path on `c1.kuangxiangit.com` first, because the `e1`/`e2` hosts its pages link time out from abroad); Rust retries transient failures (connection errors, 5xx, 429) once per URL; the download runs in the background, and the form offers "Tải lại ảnh bìa gốc" when every candidate failed. Errors name the cause (`net::describe_request_error`) instead of reqwest's bare "error sending request" |
| **`ttc_create_story` returns the JSON answer of TTC** | `Accept: application/json` makes TTC answer `{ success, message }`; its message (duplicate story, banned words) is shown verbatim. A non-JSON answer (login page) is an error, not a silent success |
| **Translation house style** | `ai/styleGuide.ts` is a condensed version of the base prompts of the QT AI translator (quick-translator-engine, `qt-ai-core/prompts/prompts.json`): faithful translation, natural Vietnamese instead of character-by-character Hán-Việt, register chosen by setting (ancient vs modern). The narrator is always "ta" and "tôi" lives only inside dialogue; titles never use "Tôi" (`titleUsesToi` warns when the model slips). Requested deviations: "cha" instead of "bố" everywhere, "nương" / "mẫu thân" instead of "mẹ" in ancient settings |
| **AI call in Rust** | OpenAI-compatible hubs rarely send CORS headers. Gemini uses `generateContent` with `responseMimeType: application/json`; OpenAI-compatible uses `chat/completions` with `response_format: json_object` |

### Related files

| File | Purpose |
|------|---------|
| `components/CreateBookModal.tsx` | Form UI (fields mirror the TTC form, "Aa" title-case buttons, cover, rules) |
| `hooks/useCreateBook.ts` | Form state, AI fill, copyright check, pending cover, submit |
| `createBookApi.ts` | Page parsing, field building, submit, `/api/check-copyright` |
| `sources/` | `detectSource`, per-site parsers, `fetchSourceBook` |
| `ai/` | `buildFillPrompt`, `parseFillResponse`, `aiFillBook` |
| `src-tauri/src/novel_source.rs` | `source_fetch_text`, `source_fetch_image` |
| `src-tauri/src/ai.rs` | `ai_generate_json` |
| `src-tauri/src/ttc/books.rs` | `ttc_create_story` |

## Pending Stories: Badge + Delete

The list JSON (`/my-stories?...&ajax=true`) carries `approved` per story. `approved === false` means the story is still waiting for a moderator: `BookCard` shows a "Chờ duyệt" badge and, only then, a delete button (same rule as the status column on the site).

Deleting uses `POST /xoa-truyen/{id}` with the session CSRF token (form field `_csrf`). The site no longer renders a button for it, but the route is served. Details worth knowing:

- `/my-stories` has no CSRF token, so `ttc_delete_story` reads it from the `/dang-truyen` form first.
- TTC answers with a 302 to `/my-stories` and reports the outcome there as a flash message in `window.PAGE_DATA` (`successMsg` / `errorMsg`). reqwest follows the redirect, and `interpret_delete_result` maps the landing page to `Ok(Some(msg))`, `Ok(None)` (no message: re-check the list) or `Err(msg)`.
- The route and its error path were verified against the live site with a non-existent story id. Which stories TTC actually allows to be deleted is decided by TTC; its answer is shown unchanged.
- `DeleteBookModal` asks for confirmation first: the delete is irreversible.

## Known Limitations

1. **Session expiry**: No auto-refresh — user must re-login when session expires
2. **Chapter parsing**: Only detects "Chương N:" heading format
3. **Cover crop**: Uses canvas-based cropping (no rotation support in output)
4. **Download ordering**: Multi-threaded downloads may write chunks out-of-order for "single" mode
5. **Upload queue is in-memory only**: Pending jobs are lost on app restart
6. **AI key storage**: the AI API key is kept in localStorage with the other settings (plain text, this machine only)
7. **Source sites can change**: the AI fill reads unsigned web pages/endpoints; a layout or anti-bot change on Fanqie / QQ / Qidian breaks that source until its parser is updated

