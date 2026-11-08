# TTC Uploader — Technical Documentation

> Desktop-only feature for managing books and chapters on TiemTruyenChu (TTC) — a Vietnamese web novel platform.

## Overview

TTC Uploader provides a desktop GUI to:
- **Authenticate** with one or more TTC accounts via cookie-based sessions (opens a real login webview), and switch between them
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
│   ├── useTtcAuth.ts            # Accounts: startup check, add (login polling), switch, logout
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
├── accounts.rs     # Account list model (ttc_accounts.json), legacy migration, /account parsing
├── client.rs       # Shared reqwest::Client + get_session / get_session_for
├── session.rs      # Accounts as managed state, login window, account commands
├── image.rs        # Image proxy with in-memory cache
├── books.rs        # Book CRUD: fetch list, HTML forms, cover upload
├── chapters.rs     # Chapter commands: fetch, parse, upload, download
└── utils.rs        # OS file manager opener, filename sanitization
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Shared `TtcClient`** | Single `reqwest::Client` managed as Tauri state → connection pooling instead of one-off clients |
| **`get_session()` / `get_session_for()`** | One place resolves a cookie: the active account, or the account a queued job names |
| **`base64` crate** | Replaces 24-line hand-rolled base64 encoder with battle-tested crate |
| **Image cache in-memory** | `TtcImageCache` (HashMap) prevents re-fetching poster images on navigation |
| **Accounts on disk** | `ttc_accounts.json` in app data dir (atomic writes) persists every login across restarts; `ttc_session.dat` of 1.2.x is adopted once, its username read from `/account` on the first check |

### Command Reference

| Command | Module | Description |
|---------|--------|-------------|
| `ttc_open_login` | session | Clear the TTC webview cookies, open the login window |
| `ttc_check_session` | session | Poll: `waiting` / `closed` / `added` (cookie verified on `/account`, account added or refreshed, made active) |
| `ttc_list_accounts` | session | Saved accounts + active, no network |
| `ttc_verify_active` | session | Check the active cookie on `/account`; a rejected one is marked `needsLogin` |
| `ttc_switch_account` | session | Make an account active, then verify it |
| `ttc_logout` | session | Forget an account (default: active); the next becomes active |
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
Returns: `{ accounts, active, checkingSession, loggingIn, switching, error, clearError, addAccount, switchAccount, logout }`

### `useTtcBooks(account)`
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
  useTtcAuth.addAccount()
    → invoke('ttc_open_login')     → Clears TTC webview cookies, opens the login window
    → poll invoke('ttc_check_session') every 2s
    → session cookie accepted by /account → account (username, display name) upserted,
      made active, saved to ttc_accounts.json → TtcWorkspace remounts for that account

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
| BookQQ | any `*.qq.com` book page (bid or `1e9 + bid`) | `detailadr.reader.qq.com/book/queryDetailPage` (public JSON) | none |
| Qidian | `qidian.com/{book,info,chapter}/{id}` on any subdomain | SSR page context of `m.qidian.com/book/{id}/` | none |
| Qimao | `qimao.com/shuku/{id}/`, chapter `shuku/{id}-{chapterId}/` | markup of the server-rendered book page (its `__NUXT__` state is a JS program, not data) | none |
| SFACG | `book.sfacg.com/Novel/{id}/[…chapter]`, `m.sfacg.com/{b,i}/{id}/`, chapter `m.sfacg.com/c/{chapterId}/` | `m.sfacg.com/b/{id}/` (full synopsis) + `book.sfacg.com/Novel/{id}/` (tags) | none |
| Faloo | `faloo.com/{id}.html`, chapter `{id}_{n}.html`, chapter list `html_{prefix}_{id}/` | `b.faloo.com/{id}.html`: Open Graph tags (declared with `name=`) + markup. **GB2312**, decoded in Rust | none |
| JJWXC | `onebook.php?novelid={id}[&chapterid=n]`, mobile `/book2/{id}[/{chapter}]`, on any `jjwxc*` domain | `app.jjwxc.net/androidapi/novelbasicinfo` (UTF-8 JSON; the web pages are GB18030 HTML) | none |
| Ciweimao | `{www,mip,wap}.ciweimao.com/book/{id}` | `www.ciweimao.com/book/{id}`: Open Graph tags + markup | none |
| sangtacviet (mirror) | `/truyen/{faloo,qidian,fanqie,ciweimao,jjwxc,sfacg,qimao}/{n}/{id}/` on **any** host (the mirror moves between domains and bare IPs) | the original site, resolved from the path | none |

`www.qidian.com` answers HTTP 202 with a JS probe, so the mobile site is used; no signing worker is involved. A Fanqie chapter link (`/reader/{itemId}`) carries no book id and is rejected.

Chapter links are normalized to the book: most carry the book id in the path. `m.sfacg.com/c/{chapterId}/` does not, so `detectChapterLookup` + `sfacgBookIdFromChapter` read it from the back link of the chapter page (one extra fetch).

Non-UTF-8 pages: reqwest is built with its `charset` feature, so `Response::text` decodes by the charset in the `Content-Type` header (Faloo declares `gb2312`). A source that declares its charset only in a `<meta>` tag would still come out garbled; JJWXC is such a site, which is one reason its JSON endpoint is used instead.

JJWXC links are accepted on any `jjwxc*` domain (mirrors, renamed or dead domains): only the novel id is read from the link, and the request always goes to the allowlisted `app.jjwxc.net`.

www.qimao.com sends folded response headers (lines starting with a space), which hyper rejects by default; `ttc::client::build_http_client` enables `http1_allow_obsolete_multiline_headers_in_responses` for the shared client.

### Key design decisions

| Decision | Rationale |
|----------|-----------|
| **Fetch in Rust, parse in TS** | The webview cannot call the sites (CORS; WAFs reject a webview `Origin`). Parsing stays in TS where it is unit-tested against fixtures |
| **What the Rust fetchers may reach** | `source_fetch_text` only talks to an allowlist of metadata hosts. `source_fetch_image` cannot use a host list, because covers are hot-linked from anywhere (JJWXC authors use Baidu, Weibo, image hosts): it accepts any **public https domain** (no IP literal, `localhost` or intranet name), re-checks every redirect hop through its own client, and requires the body to be an image by its magic bytes. Neither is a general-purpose proxy |
| **A new book resets the form** | The hook remembers which source book the form was filled from. Filling from a different book first clears every AI-derived field and the cover taken from the previous book (a cover the user picked from disk is kept), so a failed AI call or cover download cannot leave one book's translation next to another book's source fields. Re-filling the same book keeps everything |
| **Model reply that is not quite JSON** | `repairJson` fixes what models outside a strict JSON mode get wrong in long text fields (raw line breaks, plain double quotes in dialogue, trailing comma); it runs only after a strict parse fails. A reply cut off by the output limit (`MAX_TOKENS` / `length`) is still used when its first JSON object was closed before the cut (Gemini JSON mode can keep emitting whitespace after the closing brace until the limit); otherwise the error says where the tokens went (reasoning vs answer, from the provider usage) and quotes the end of the answer, because a model that thinks at length can spend the whole limit a hub sets before answering, which a retry does not fix. A reply that still cannot be read is quoted in the error |
| **Option lists from the live form** | Categories come from the TTC page, not a hardcoded list; the picks of the model are validated against them and anything else is dropped |
| **Model reply is untrusted** | `parseFillResponse` accepts bare / fenced / prose-wrapped JSON, title-cases names, and never throws on a bad category (it leaves the field for the user) |
| **Cover is pending until the story exists** | TTC uploads covers per story id, so the image is held in memory and uploaded right after `ttc_create_story`; a failed cover upload is reported without hiding that the story was created. The gateway of TTC sometimes answers the cover request with HTTP 504 after the story went through, so both `CreateBookModal` and `EditBookModal` keep the cropped image and offer "Thử lại tải ảnh bìa": only the cover request is repeated, never the create form |
| **Cover download tolerates a flaky CDN** | The cover CDNs (byteimg especially) can stall or drop a cold connection from outside mainland China. Each source yields ordered `coverUrls` (Fanqie: `…~tplv-shrink:640:0.image` first, `origin/…` as fallback; Ciweimao: the same path on `c1.kuangxiangit.com` first, because the `e1`/`e2` hosts its pages link time out from abroad; Baidu-hosted covers: a `@w_600,q_80` rendition first, about 100KB instead of a multi-megabyte original); Rust retries transient failures (connection errors, 5xx, 429) once per URL; the download runs in the background, and the form offers "Tải lại ảnh bìa gốc" when every candidate failed. Errors name the cause (`net::describe_request_error`) instead of reqwest's bare "error sending request" |
| **`ttc_create_story` returns the JSON answer of TTC** | `Accept: application/json` makes TTC answer `{ success, message }`; its message (duplicate story, banned words) is shown verbatim. A non-JSON answer (login page) is an error, not a silent success |
| **Re-fill an existing story** | `EditBookModal` reuses the create-story machinery through `useSourceRefill`, keyed on the story's "Link gốc": "AI điền lại" reads the source again and puts author, category, sub-categories and description into the form (the model's title is only offered, never applied quietly); "Tải ảnh bìa từ nguồn" downloads the cover again and sends it through the cropper like a picked file. A cover upload no longer closes the modal (the user may still be editing); closing after one refreshes the list |
| **Edit a story waiting for approval** | TTC keeps every field of a pending story editable (title, type, gender, length, Chinese title and link, original author); once approved only author, categories, description and status stay open. `EditBookModal` gets `pending` from the list (`isPendingApproval`) and then shows the fields of the create form (shared: `BOOK_TYPE_OPTIONS` / `GENDER_OPTIONS` / `LENGTH_OPTIONS` in `constants.ts`, `TitleCaseInput`); "Sáng Tác" hides the Chinese source, as on TTC. `fetchEditBookForm` reads each field as the page posts it (`FormData`, falling back to a disabled control), so the type comes out right whether it is a select (pending) or an input; sub-categories keep their position |
| **Content filters** | A provider can refuse the prompt itself: hubs in front of Gemini return the refusal as the reply text ("The prompt could not be submitted. The prompt contains sensitive words..."), the Gemini API as a block reason. `isContentBlock` recognizes both. Romance synopses are the usual trigger and these filters cannot be configured away, so `aiFillBook` repeats the request once without the synopsis: every field but the description is still filled, and the form says why the description is empty. A refusal of that second request is reported as what it is, not as a JSON error |
| **Translation house style** | `ai/styleGuide.ts` is a condensed version of the base prompts of the QT AI translator (quick-translator-engine, `qt-ai-core/prompts/prompts.json`): faithful translation, natural Vietnamese instead of character-by-character Hán-Việt, register chosen by setting (ancient vs modern). The narrator is always "ta" and "tôi" lives only inside dialogue; titles never use "Tôi" (`titleUsesToi` warns when the model slips). Requested deviations: "cha" instead of "bố" everywhere, "nương" / "mẫu thân" instead of "mẹ" in ancient settings |
| **AI call in Rust** | OpenAI-compatible hubs rarely send CORS headers. Gemini uses `generateContent` with `responseMimeType: application/json`; OpenAI-compatible uses `chat/completions` with `response_format: json_object` |
| **Explicit output limit on OpenAI-compatible requests** | A request without a limit gets the hub default, which counts reasoning: one hub in front of `gemini-3.8-flash` cut every reply at 4501 tokens while the model spent 5 to 7 thousand thinking about one synopsis (the hub ignores `reasoning_effort` and reports no `reasoning_tokens`). `openai_body` sends 32768 as `max_completion_tokens` to api.openai.com (its reasoning models reject `max_tokens`) and as `max_tokens` elsewhere; an HTTP 400/422 that names the parameter is retried once without it, for models with a lower ceiling. The Gemini API already defaults to the model maximum, so `gemini_body` sets none |

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

## Multiple Accounts

The app keeps every TTC account the user logged into; one is active at a time (`AccountSwitcher` in the header: switch, "Thêm tài khoản", "Đăng xuất tài khoản này").

- **Identity**: `/account` carries `socketUsername` (stable key) and `displayName` in `window.PAGE_DATA` (`accounts::parse_account_page`). The same request is the validity check: an expired cookie gets the login page instead.
- **Pinned jobs**: `UploadOptions.account` / `DownloadAllOptions.account` are set to the active username when a job is queued; `ttc_upload_chapters`, `ttc_download_all_chapters` (and the `ttc_fetch_chapters` / `ttc_download_chapter` calls it makes) resolve the cookie with `get_session_for`. A job whose account was logged out fails with a message naming the account. The queues show `@username` per job.
- **Switching** remounts `TtcWorkspace` (keyed by username), so nothing of the previous account survives in the UI.
- **Expired account**: marked `needsLogin`, never deleted; "Đăng nhập lại" opens the login window and the new cookie replaces the old one for the same username.

## Settings Store (desktop)

`usePersistentState` (formerly `useLocalStorage`) reads and writes through `shared/utils/persistentStore`. On desktop that is `user_data.json` in the app data dir (Rust `user_store`): loaded into memory before the first render, writes sent to Rust one at a time in call order. The first run copied every webview localStorage key into it (`user_store_import` refuses to run twice); localStorage was left as it was. On the web nothing changed.

## Pending Stories: Badge + Delete

The list JSON (`/my-stories?...&ajax=true`) carries `approved` per story. `approved === false` means the story is still waiting for a moderator: `BookCard` shows a "Chờ duyệt" badge and, only then, a delete button (same rule as the status column on the site).

Deleting uses `POST /xoa-truyen/{id}` with the session CSRF token (form field `_csrf`). The site no longer renders a button for it, but the route is served. Details worth knowing:

- `/my-stories` has no CSRF token, so `ttc_delete_story` reads it from the `/dang-truyen` form first.
- TTC answers with a 302 to `/my-stories` and reports the outcome there as a flash message in `window.PAGE_DATA` (`successMsg` / `errorMsg`). reqwest follows the redirect, and `interpret_delete_result` maps the landing page to `Ok(Some(msg))`, `Ok(None)` (no message: re-check the list) or `Err(msg)`.
- The route and its error path were verified against the live site with a non-existent story id. Which stories TTC actually allows to be deleted is decided by TTC; its answer is shown unchanged.
- `DeleteBookModal` asks for confirmation first: the delete is irreversible.

## Abandon Check ("Check vô hố")

TTC treats an ongoing ("Đang ra") story with no new chapter for 12 days as abandoned; another translator may then claim it. Re-uploading any existing chapter resets the date, so the toolbar button "Check vô hố" opens `AbandonCheckModal`, which re-uploads chapter 1 of each story the user picks.

```
AbandonCheckModal → useAbandonCheck
  ttc_fetch_books(status=ongoing, every page)  → rows sorted by days since last_chap_updated
  per story, one at a time:
    pending approval / 0 chapters on TTC       → invalid
    no folder picked *for this book*           → invalid (the global folderPath is ignored on purpose)
    ttc_read_folder_files → parseLocalChapters(book settings) → chapter with index 1, else invalid
    ttc_fetch_chapters(page 1, limit 1)        → title differs from the folder: warning, not preselected
  Reup → addJob(one chapter, price rules of the book, pinned to the active account) per story → UploadQueueContext runs them in turn
```

- The folder is split in a Web Worker (`utils/localChapters.worker.ts` via `utils/chapterParser.ts`; only chapter 1 comes back): splitting a 1000-chapter novel takes about a second, which froze the modal when it ran on the main thread story after story.
- `utils/localChapters.ts` holds the folder → chapters parsing and the VIP price rules, shared with `useTtcChapters`, so the re-uploaded chapter 1 is exactly what "Đồng bộ" would upload.
- `utils/abandon.ts`: `ABANDON_DAYS` (12), day count and risk level. Only stories at least N days without a chapter are preselected (default `DEFAULT_REUP_FROM_DAYS` = 7, adjustable in the modal, kept in localStorage `nk_ttc_reup_from_days`). The rule lives on TTC; change the constant if TTC changes it.
- Several reup jobs start back to back, and TTC has answered `/dang-chuong/{id}` with HTTP 500 in that situation. `ttc_fetch_upload_tokens` retries connection errors, 5xx and 429 (3 attempts, 3s then 6s) and logs the status and body of every failure. A failed reup can be selected and queued again from the modal.
- `addJob` of the upload queue returns the job id, so the modal shows the status of the jobs it queued.

## Book List: Tabs and Source Filter

The list is loaded whole for the status filter and the search (`useTtcBooks` → `fetchAllBooks`, 200 stories per page, TTC's own search), then everything else is local (`useBookTabs`, `utils/bookFilters.ts`): tabs, source filter and pages, so counts and pages are right whatever the filter.

| Tab | Shows |
|-----|-------|
| Tất cả | the list as TTC returns it |
| Chờ duyệt | `approved === false` |
| Chưa có chương | `total_chapters === 0` |
| Chưa chọn folder | no folder in the settings of that very story |
| Chưa đồng bộ | folder ahead of TTC, latest chapter different, or folder unreadable |

- **Source filter**: the source of a story comes from its `chinese_link` (`utils/sourceSite.ts`: short names of `SOURCE_LABELS`, the host for other sites, "Không có nguồn" without a link). Several sources can be picked; none = all. Tab counts follow it; source counts follow the open tab but not the source filter (every source stays pickable, in a fixed order; one with no story in the tab is disabled).
- **"Chưa đồng bộ"** compares each folder with what the list already says (`utils/folderSync.ts`: number of chapters and title of the latest one), with no request to TTC. Folders are read only while the tab is open (`useFolderSyncStatus`, one at a time in the parser worker) and a result is kept until the folder, the parse settings or the story on TTC change. An older chapter edited in the folder is not seen here: "Quét chương mới" reads every chapter on TTC.
- `SourceLink` shows the source on the card and in the book header and opens it in the default browser (`shared/utils/openExternal.ts`: shell plugin, web pages only).

## Sync Scan ("Quét chương mới")

The toolbar button "Quét chương mới" opens `SyncScanModal`: every story whose folder is ahead of TTC (new chapters) or differs from it, with the uploads queued in one go.

```
SyncScanModal → useSyncScan
  fetchAllBooks('ongoing,full,paused')          → only stories with a folder picked *for this book*; the others are counted
  per story, one at a time:
    ttc_read_folder_files → worker allChapters(book settings)   → nothing parsed: invalid
    fetchAllChapters(bookId)                                     (pages of 1000, sorted)
    compareChapters + planSync (utils/syncCompare.ts):
      no changed chapter, N new  → 'new'      upload the chapters after the last one on TTC (append), preselected
      first changed chapter X    → 'changed'  upload X..end of the folder (overwrite), NOT preselected;
                                              the row shows the first differing titles
      otherwise                  → 'synced'   (says when TTC has more chapters than the folder)
  Upload → addJob(chapters, price rules of the book, pinned to the active account) per story
```

- `compareChapters` is the analysis the "So sánh & Upload" tab always used (same position, title or > 3% word count difference), moved out of `ResyncComparisonTable` so the scan and the tab cannot disagree. The tab now resets its page while rendering instead of in an effect (same behavior; `react-hooks/set-state-in-effect`).
- `utils/ttcLists.ts`: `fetchAllBooks(status)` and `fetchAllChapters(bookId)`, shared with the abandon check and the sync page.
- The worker (`localChapters.worker.ts`) gained `allChapters`; only the chapters to upload are kept in the row.
- Filter tabs (Tất cả / Chương mới / Chưa đồng bộ / Đã đồng bộ / Lỗi) only change what is shown: "Chọn tất cả" applies to the open tab, picks made in other tabs stay and are uploaded too.

## Revenue ("Doanh thu")

Today's revenue of the active account sits in the app header on the TTC page only (`RevenueTicker`; the sync itself runs on every page) and runs up as it is read; a click opens `RevenueModal` (last 7 days, any day, hours in Vietnam time, stories). The modal is portaled to the body: the header has a `backdrop-filter`, which would make it the containing block of a `fixed` overlay.

**Source.** TTC has no revenue page: every sale is a notification in the "Tài chính" tab, `/thong-bao?type=purchase&page=N` (50 per page, newest first, server-rendered). Income reads `💰 Nhận <b>90 hoa</b> từ lượt mua chương 59 - <b>Title</b>`, for a bulk sale `… từ lượt mua 10 chương - …`, and for a gift `🎁 Nhận được <b>180,000 hoa</b> tặng cho <b>Title</b>` (a gift adds hoa but no purchase; amounts use `.` or `,`). Bulk sales and gifts can outweigh a whole day of single sales, so a day keeps their own tallies (`bulk`, `gifts`) and the modal shows them next to the total. Files of an older `LEDGER_VERSION` are ignored and rebuilt from TTC. The UI does not repeat "giờ VN" (all users are in Vietnam), but days and hours are still computed in UTC+7.

The modal has a fixed height with the day controls pinned, the top 10 stories with a "Xem thêm", and a hand-built chart (`HourChart`, no chart library: one 24-bar series; revisit if zooming or multi-series charts are needed). The story id is in the `onclick` (`/truyen/27412`). The page only shows "2 phút trước", but the id (`1793719900176_kjua`) starts with the creation time in epoch ms (it matches `time` of `/api/notifications/latest` to a few ms). The tab also lists spending ("Bạn đã đề cử … Trừ 10.000 hoa"), which is not income.

**Retention.** TTC keeps about the last 5000 notifications of an account (all types together), i.e. about a week at current volume. Older days exist only in the app's ledger, so it syncs on every start.

```
revenue/
  vnTime.ts          Vietnam days/hours (UTC+7, fixed)
  parsePurchases.ts  one page → entries {id, ts, income | null}, last page number
  ledger.ts          DayStats (hoa, count, hours[24], stories), covered spans, dayCoverage
  syncWalk.ts        walkPurchases: newest → back to the last sync (all pages on the first run)
  store.ts           files via Rust (ttc::revenue): sync.json + one file per month; commit journal
  revenueEngine.ts   per account: sync on start, every 2 min, midnight rollover; useSyncExternalStore
  RevenueProvider / RevenueTicker / RevenueModal / useCountUp
```

- **Files, not `user_data.json`**: `<app data>/revenue/<username>/<YYYY-MM>.json` (daily totals, ~1–3 KB a day) and `sync.json`. `user_data.json` is read whole before the first render and rewritten on every settings change.
- **Covered spans.** `sync.json` lists the spans of time whose purchases are all counted. A walk reads from page 1 until it passes the edge of the last span (`min(last sync, newest entry seen) − 10 min` overlap; ids counted in the overlap are kept in `recentIds`, so late-listed entries are counted and nothing twice). Entries pushed to the next page by new sales while reading are skipped by id. Closing the app before midnight loses nothing: the next start reads the hole (evening, midnight, morning) and puts each sale on its own day and hour. If the list ends before the last sync (app not opened for ~a week), the time in between is lost and stays a visible gap; `dayCoverage` tells the modal which hours of a day are missing.
- **Exactly once.** A walk writes nothing until it is done (a walk cut short is simply done again). The commit first writes the new state plus the incomes to `sync.json` as a journal, then adds them to the month files (which remember the commit id), then clears the journal; `readSync` finishes a journal left by a crash.
- **Account switch.** `RevenueProvider` keeps one `RevenueEngine` per active account (`useActiveTtcAccount`, driven by `ttc://accounts-changed`); `stop` drops a running walk before it writes. `ttc_fetch_purchases` takes the account explicitly.
- Read only: the walk never marks notifications read or deletes them. Turning off "mua chương" notifications on TTC, or deleting them, removes the data the ledger is built from.

## Drip Upload ("Nổi trên bảng cập nhật")

TTC lists the stories that just got a chapter on its update board. Uploading 300 chapters at once puts a story there once; dripping them keeps it there. Per story, the sync page offers "Cách đăng": **Đăng ngay** (the normal upload) or **Nổi trên bảng cập nhật**. Only one is active: a story with a drip plan has no upload button, and drip cannot start while a normal upload of the story is queued or running.

```
DripProvider (App, desktop) → DripEngine (drip/dripEngine.ts), saved in the user data store (nk_ttc_drip)
  at most every TICK_MS (15s), earlier when a turn or a waiting plan is due; if the upload queue is idle:
    1. plans with `priority` (just started/resumed, or after a bulk step): evaluated right away
    2. if `intervalMinutes` passed since the last upload: running plans, posted longest ago first
  evaluate one plan: folder (worker parse, book settings) + full TTC list (its own account)
    → decideDripStep (drip/steps.ts):
       resync    chapter on TTC differs → overwrite first difference … last chapter on TTC
       initial   TTC has fewer than `initialBatch` → upload up to it in one job
       drip      the next chapter after the last one on TTC, alone
       caught-up nothing new → skip without using the turn, look again in 30 min
  upload → addJob(…, { silent: true }) → waitForJob → removeJob when done
```

- **TTC is the state.** Nothing like "uploaded up to N" is stored: every turn compares the folder with TTC's list (`compareChapters`, the same verdict as "So sánh & Upload"). An app restart, an interrupted initial batch or an edited chapter 101 of 200 all continue correctly: resync 101–200, then drip 201.
- **One interval for all stories, rotated.** Every `intervalMinutes` (default 5, from 0.5 = 30 seconds up to 1440, in tenths of a minute) one chapter of one story goes up; the story posted longest ago goes first, so as many stories as possible stay on the board. Bulk steps (resync, initial batch) do not wait for the interval. The interval is edited in the "Nổi bảng" modal and in the drip controls of the sync page (`DripIntervalInput`, same value); a change applies at once (the next turn is `lastTurnAt + interval`, and the scheduler looks again right away).
- **Progress.** Each look stores the last chapter on TTC (`ttcChapters`) and in the folder (`localChapters`). The modal adds them up over all plans and estimates the time left as (chapters left to drip) × interval, since all stories share one chapter per interval; the initial batches are not counted, they go up at once. The last 100 uploads, failures included, are kept in `history` (tab "Lịch sử đăng").
- **Rate limits and the queue.** Drip jobs go through the upload queue, so they never run next to another upload; the engine waits while the queue has anything pending or running. Within a job the Rust 429 / "chờ Ns" handling applies as for any upload.
- **Accounts.** A plan names its account; the chapter list and the upload use that account's session, so plans of several accounts run side by side whatever account is active.
- **Failures.** No folder / unreadable folder / nothing parsed: the plan stops (`error`) and a notification says why. TTC unreachable or a failed upload: retried after 5 minutes; after 3 failures in a row the plan stops. Pausing or removing a plan cancels its running upload, which does not count as a failure.
- **Other bulk tools.** "Quét chương mới" leaves drip stories alone (it would upload their new chapters at once). "Check vô hố" may still reup chapter 1 of them.
- Upload queue: `addJob(options, title, { silent })` (no desktop notification per drip post) and `waitForJob(id)` (resolves when the job is done, failed, cancelled or removed while pending).
- **Limitation:** it runs only while NovelKit is open.

## Mèo Truyện ("Đăng lên Mèo Truyện")

Female stories ("Nữ" in TTC's list, `gender`) get a "Mèo Truyện" button on their card: the story and the chapters of its folder go to meotruyen.com, a romance reading site, as a **draft** published from that site's edit page. The site's import API is the one its own `npm run import` uses (meotruyen repo, `docs/import-format.md`); no zip is built: the same content is sent as JSON.

```
MeoTruyenModal → useMeoTruyenUpload (meotruyen/)
  on open, side by side:
    meotruyen_genres (/api/genres: 11 genres, ~280 tags)  → aiPickMeo (ai.ts): genres, tags, editor's note
    folder (worker parse, book settings)                  → ParsedChapter[]
    TTC poster (ttc_proxy_image) → cover.ts: centre 3:4, JPEG 600×800 ≤300 KB + 180×240 ≤60 KB
  buildMeoImport (buildImport.ts): TTC story + chapters + picks → open body, chapter texts, problems
  send: meotruyen_import_open → 409 duplicate_book? → meotruyen_import_send (batches ≤100 chapters, ≤4 MB, 3 tries)
        → meotruyen_import_finalize → MeoLink saved (nk_meotruyen_links, by TTC story id)
```

- **Fields.** Title, Chinese title (required: the site checks duplicates on it and on the source link), author, original author, source link (`chinese_link`, dropped with a warning when it is not http/https), synopsis (TTC's `description` as is), status (`full` → `completed`), `appId` = TTC story id. Translator is left empty: the site uses the token owner's name. The model only picks genres and tags (slugs of the live list; a name is matched too, anything else dropped) and writes the editor's note (≤300 characters, editable). A refusal by the provider's content filter is retried without the synopsis, as in the create-story fill.
- **The site's rules, copied.** `meotruyen/rules.ts` copies `formatChapterFile`, the limits and `chapterBatches` from the meotruyen repo (`shared/import.ts`, `shared/text.ts`), so the text sent is exactly what the site's importer would send, and every problem shows before a job is opened: chapters numbered 1..N without a gap (a folder with "bỏ qua N chương đầu" cannot go), no empty chapter, ≤200 KB each, titles ≤200 characters, at least one genre. Keep the copy in step when the site changes those rules.
- **Duplicates and updates.** A story imported before is remembered (`MeoLink`: book id, slug, picks, chapters, date) and its button shows a check. Sending again reuses its picks without asking the model, and when the site answers `duplicate_book` with that same book and nothing to lose (`chaptersDeleted` 0) it is overwritten without a question: chapters with the same number are replaced, new ones added, comments kept. Any other duplicate (or one that would delete chapters) is shown with what an overwrite would cost, and only an explicit "Ghi đè truyện này" sends it.
- **Token.** `AppSettings.meoTruyen.token` (Cài đặt → Mèo Truyện); empty = the `MEOTRUYEN_TOKEN` environment variable, read by Rust. `src-tauri/src/meotruyen.rs` fixes the origin (`https://meotruyen.com`), puts the token in the `Authorization` header only (never in a URL or an error), checks job ids before they go into a path, and returns the site's `{ status, code, message, details }` as the error. The site answers a bad, expired or revoked token with a plain 404.
- **Failures.** A 400 lists every problem the site found. A batch or the finalize is tried 3 times on a network error or a 5xx; a failure after that leaves the job open on the site (it expires after 24 hours) and nothing changed: sending again starts over. A finalize that answers `import_closed` with status `done` means an earlier try created the book and only its reply was lost.

## Known Limitations

1. **Session expiry**: No auto-refresh — an expired account is marked "Cần đăng nhập lại" and the user logs in again from the banner
2. **Chapter parsing**: Only detects "Chương N:" heading format
3. **Cover crop**: Uses canvas-based cropping (no rotation support in output)
4. **Download ordering**: Multi-threaded downloads may write chunks out-of-order for "single" mode
5. **Upload queue is in-memory only**: Pending jobs are lost on app restart
6. **AI key storage**: the AI API key is kept with the other settings in `user_data.json` in the app data dir (plain text, this machine only)
7. **Source sites can change**: the AI fill reads unsigned web pages/endpoints; a layout or anti-bot change on Fanqie / QQ / Qidian breaks that source until its parser is updated

