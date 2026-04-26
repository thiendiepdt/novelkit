# AGENTS.md — AI Developer Guide for NovelKit

> This document is written for AI coding agents (Cursor, Copilot, Gemini, Claude, etc.) working on the NovelKit codebase. It describes architecture, conventions, and common pitfalls to avoid.

## Project Identity

- **Name**: NovelKit
- **Purpose**: Web & desktop toolkit for Chinese novel converters/translators
- **Target Users**: Vietnamese novel translation community (converter/dịch giả)
- **Language**: UI is in Vietnamese, code comments/docs in English
- **License**: GPLv3

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.x |
| Build | Vite | 8.x |
| Language | TypeScript | 6.x (strict mode) |
| Styling | TailwindCSS | 4.x |
| Routing | react-router-dom | 7.x |
| Worker IPC | Comlink | 4.x |
| Storage | IndexedDB (via `idb`) | 8.x |
| Desktop | Tauri | 2.x |
| Desktop Lang | Rust | 1.77+ |
| Testing | Vitest + @testing-library/react | latest |

## Architecture

### Feature-Based Structure

```
src/                        # React frontend (shared by web & desktop)
├── features/               # Each feature is a self-contained module
│   ├── home/               # Landing page with tool cards
│   ├── text-formatter/     # Format novel text (trim, dedupe blank lines, detect Chinese)
│   ├── chapter-splitter/   # Split long chapters into parts by word count
│   ├── translator/         # Chinese→Vietnamese dictionary-based translator (QT Web)
│   ├── ttc-uploader/       # TiemTruyenChu book/chapter management (desktop only)
│   └── downloads/          # Download queue detail page (desktop only)
├── shared/                 # Cross-feature shared code
│   ├── components/         # Reusable UI components (Header, Footer, MiniMap, UploadQueueManager, etc.)
│   ├── context/            # React contexts (DownloadQueueContext, UploadQueueContext)
│   ├── hooks/              # Custom React hooks (useLocalStorage, useDragDrop)
│   ├── types/              # Shared TypeScript types (DownloadAllOptions, etc.)
│   └── utils/              # Pure utility functions (clipboard, download, regex, platform)
└── index.css               # Global design system (TailwindCSS @theme tokens)

src-tauri/                  # Tauri Rust backend (desktop only)
├── src/
│   ├── main.rs             # Thin entry point
│   ├── lib.rs              # App builder, plugin registration, managed state
│   └── ttc/                # TTC feature backend (modular)
│       ├── mod.rs           # Module declarations
│       ├── types.rs         # Serde structs for API payloads & responses
│       ├── client.rs        # Shared reqwest::Client + session helper
│       ├── session.rs       # Session persistence, login/logout commands
│       ├── image.rs         # Image proxy with in-memory cache
│       ├── books.rs         # Book CRUD: fetch list, HTML forms, cover upload
│       ├── chapters.rs      # Chapter fetch, parse, upload, download commands
│       └── utils.rs         # OS file manager opener, filename sanitization
├── capabilities/           # Tauri v2 permission/security config
├── icons/                  # App icons for different platforms
├── tauri.conf.json         # Tauri configuration (window, bundle, build)
└── Cargo.toml              # Rust dependencies
```

### Critical Rule: No Cross-Feature Imports

```
✅ features/chapter-splitter → shared/components/FullscreenPreview
✅ features/translator → shared/utils/clipboard
❌ features/chapter-splitter → features/text-formatter/components/...
```

If two features need the same component, **move it to `shared/`**.

### Critical Rule: Always Check ESLint & TypeScript

After making any code changes, **you MUST run** the following commands to ensure there are no linting or type errors before concluding your task:
1. `npm run lint`
2. `npx tsc --noEmit`

Do not leave unresolved TypeScript (`.ts(2304)`, etc.) or ESLint errors in the codebase. Fix them proactively.

**Exception**: `chapter-splitter/utils/splitter.ts` imports `formatText` from `text-formatter/utils/formatter.ts`. This is the ONLY allowed cross-feature dependency (splitter preprocesses text through the formatter). It should ideally be refactored into shared utils in the future.

> **Note**: `DownloadAllOptions` and `DownloadAllProgressEvent` live in `shared/types/download.ts` (not in `ttc-uploader/types.ts`) because they are consumed by `shared/context/DownloadQueueContext.tsx`. The `ttc-uploader/types.ts` re-exports them for convenience.

> **Note**: `UploadProgressEvent` and `UploadOptions` are imported by `shared/context/UploadQueueContext.tsx` from `ttc-uploader/types.ts`. This is an allowed pattern — shared contexts may import type definitions from features they orchestrate. The `UploadJob` interface lives in `shared/context/uploadQueueDefs.ts`.

### Path Aliases

Always use `@/` path alias instead of relative paths:

```typescript
// ✅ Good
import { copyToClipboard } from '@/shared/utils/clipboard';
import { MiniMapTextarea } from '@/shared/components';

// ❌ Bad
import { copyToClipboard } from '../../shared/utils/clipboard';
```

Configuration is in `tsconfig.app.json` (`paths`) and `vite.config.ts` (`resolve.alias`).

## Design System

### Theme Tokens (defined in `src/index.css`)

The app uses a **Warm Charcoal Xianxia** dark theme. All colors are defined as CSS custom properties under `@theme`:

| Token | Usage |
|-------|-------|
| `--color-gold` / `gold` | Primary accent, CTA buttons, links |
| `--color-jade` | Success states, secondary accent |
| `--color-purple` | Names/proper nouns, tertiary accent |
| `--color-crimson` | Errors, warnings, Chinese character alerts |
| `--color-bg-*` | Background layers (primary → card → hover) |
| `--color-text-*` | Text hierarchy (primary → secondary → dim) |
| `--color-border-*` | Border states (main → gold → hover) |

### Styling Rules

1. Use **TailwindCSS utility classes** — the project uses TailwindCSS v4 with `@theme` directives
2. Custom colors are accessed via Tailwind: `text-gold`, `bg-bg-card`, `border-border-main`
3. Animations are defined as `@keyframes` in `index.css`: `fadeIn`, `slideUp`, `pulse-gold`, `shimmer`, `copySuccess`
4. **No inline CSS** except for dynamic computed values (e.g., conditional boxShadow)
5. The font stack is `'Be Vietnam Pro'` loaded from Google Fonts

## Feature Modules — Deep Dive

### Text Formatter (`features/text-formatter/`)

**Purpose**: Clean and normalize novel text.

**Core logic** (`utils/formatter.ts`):
- Strips leading tabs/spaces per line
- Collapses multiple blank lines into paragraph separators (`\n\n`)
- Detects Chinese characters (CJK Unified Ideographs range)
- Returns `FormatResult` with stats (charCount, paragraphCount, hasChinese, chineseChars)

### Chapter Splitter (`features/chapter-splitter/`)

**Purpose**: Split a long chapter (or multiple chapters) into smaller parts for publishing.

**Core logic** (`utils/splitter.ts`):
- `splitChapter()` — single chapter splitting by word count
- `splitMultipleChapters()` — multi-chapter mode, auto-detects "Chương X" headings
- `getWordCount()` — language-aware: Chinese = character count, Vietnamese = space-split
- Supports round-up/round-down modes and minimum word threshold (merge short trailing parts)

**Key architectural decision**: The splitter calls `formatText()` as a preprocessing step. This is an intentional cross-feature dependency.

**State management** (`hooks/useChapterSplitter.ts`):
- Settings persisted to localStorage via `useLocalStorage` hook
- Debounced chapter boundary detection (300ms) to avoid lag on keystrokes
- Large input detection (>10k words) switches to compact summary view

### Quick Translator (`features/translator/`)

**Purpose**: Dictionary-based Chinese→Vietnamese translation, inspired by the classic QuickTranslator C# tool.

**Architecture**:
```
UI (TranslatorPage)
  ↓ Comlink RPC
Web Worker (translator.worker.ts)
  ├── DictionaryLoader (fetch + IndexedDB cache)
  ├── DictionaryManager (in-memory Map lookups)
  └── TranslatorEngine (longest-match tokenizer)
```

**Translation algorithm**:
1. Longest-match-first: scan up to 20 characters ahead
2. Priority: Name dict → VietPhrase dict → HanViet (single char) → unmapped
3. Post-processing: collapse adjacent latin/punctuation tokens to reduce DOM nodes

**Dictionary format**: Plain text files, one entry per line: `key=value`
- `VietPhrase.txt` — multi-char phrase translations
- `Names.txt` — proper nouns (character names, place names)
- `HanViet.txt` — single-character Sino-Vietnamese readings

**Token types** (defined in `engine/types.ts`):
- `vietphrase` — matched from VietPhrase dictionary
- `name` — matched from Name dictionary (displayed in purple)
- `hanviet` — single char Sino-Vietnamese reading
- `chinese_unmapped` — Chinese char with no dictionary entry (displayed in red)
- `latin` / `punctuation` — non-Chinese characters

### TTC Uploader (`features/ttc-uploader/`)

**Purpose**: Desktop-only GUI for managing books and chapters on TiemTruyenChu (TTC).

**Architecture** (hook-based, thin orchestrator pattern):
```
TtcUploaderPage (orchestrator, ~200 lines)
  ├── useTtcAuth      → session check, login polling, logout
  ├── useTtcBooks     → book list, search, status filters, pagination
  └── useTtcChapters  → chapter list, folder parsing, upload, download

Components:
  LoginView, BookCard, BookListToolbar, BookDetailHeader,
  UploadToolbar, ChapterTable, DownloadAllModal,
  EditBookModal, CoverCropperModal, ProxiedImage
```

**Rust backend** (`src-tauri/src/ttc/`):
- `client.rs` — shared `TtcClient` (managed state, connection pooling) + `get_session()` helper
- `session.rs` — `TtcSession` struct, disk persistence, login webview commands
- `image.rs` — `TtcImageCache` + `ttc_proxy_image` (CORS bypass via Rust fetch)
- `books.rs` — `ttc_fetch_books`, `ttc_fetch_html`, `ttc_submit_multipart`, `ttc_upload_cover`
- `chapters.rs` — `ttc_fetch_chapters`, `ttc_parse_chapters`, `ttc_upload_chapters`, `ttc_download_chapter`, `ttc_download_all_chapters`
- `utils.rs` — `ttc_open_folder`, `sanitize_filename`

**Key patterns**:
- All commands use shared `TtcClient` (reqwest connection pooling) instead of creating per-request clients
- `get_session()` helper eliminates repeated session extraction boilerplate
- Upload/download progress emitted via Tauri events (`ttc://upload-progress`, `ttc://download-all-progress`)
- Download queue managed via `shared/context/DownloadQueueContext` with cancel support
- **Upload queue** managed via `shared/context/UploadQueueContext` — sequential processing with `job_id`-tagged events, cancellation via `AtomicBool`, and native desktop notifications (`tauri-plugin-notification`)
- `ttc_upload_chapters` accepts a `job_id: String` parameter; all `UploadProgressEvent` emissions include `job_id` for frontend routing

See `docs/ttc_uploader_tech.md` for detailed technical documentation.

## Shared Components

### MiniMapTextarea
A `<textarea>` with a VS Code-style minimap on the right side (desktop only). Supports:
- Draggable viewport indicator
- Clickable minimap navigation
- Optional markers (labeled positions, e.g., chapter/part boundaries)
- Hidden scrollbar with custom styling

### FullscreenPreview
Full-screen modal for reading long text. Supports:
- Escape key to close
- Body scroll lock
- Copy button
- Prev/Next navigation (for paginated content)

## Testing Conventions

- Test files live next to their source: `utils/formatter.ts` → `utils/formatter.test.ts`
- Use `describe` blocks matching the function/class name
- Test edge cases: empty input, Chinese-only text, mixed content, extremely long text
- Pure utility functions should have comprehensive unit tests
- React components: only test complex behavior, not layout

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Common Pitfalls

### 1. Chinese Character Detection
The regex `[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]` covers CJK Unified Ideographs but NOT:
- CJK Extension B-G (rare chars above U+20000) — these require surrogate pairs
- CJK punctuation (「」、。) — these are punctuation, not ideographs

Use `CHINESE_CHAR_REGEX` from `@/shared/utils/regex` as the single source of truth.

### 2. Word Count Is Language-Dependent
`getWordCount()` in `splitter.ts` uses different strategies:
- **Chinese text**: count non-whitespace characters (each char ≈ 1 word)
- **Vietnamese/Latin text**: split by whitespace

This means word counts are approximate for mixed-language text.

### 3. Web Worker Lifecycle
The translator uses a Comlink-wrapped Web Worker. Key rules:
- Worker is initialized once via `useTranslatorWorker` hook
- `api` reference from `useRef` may be null on first render
- Always check `isReady` before calling `api.translate()`
- Worker is terminated on component unmount (cleanup in useEffect)

### 4. IndexedDB for Dictionary Caching
Dictionaries are cached in IndexedDB (`cv_translator_db`). The loader:
1. Checks IDB cache first
2. Falls back to network fetch (remote URL → local `/public/dictionaries/`)
3. Caches fetched content asynchronously (non-blocking)

⚠️ Dictionary updates via `updateDictionary()` are **in-memory only** — they don't persist to IDB. This is a known limitation.

### 5. TailwindCSS v4 Specifics
This project uses TailwindCSS v4 with the new `@theme` directive (not `tailwind.config.js`). Custom colors are defined in `index.css`:
```css
@theme {
  --color-gold: #c9a96e;
  /* ... */
}
```
These are automatically available as Tailwind utilities: `text-gold`, `bg-gold`, etc.

## Desktop App (Tauri)

### Architecture

NovelKit is a **dual-target app**: the same React frontend runs in both a browser (web) and a Tauri desktop window. The `src-tauri/` directory contains the Rust backend that wraps the Vite-built frontend.

```
Browser (Web)          Tauri Desktop
─────────────          ─────────────
Vite Dev Server  ←──→  Tauri WebView
     │                      │
  src/ (React)         src/ (React)
     │                      │
  Browser APIs         Tauri Plugins (Rust)
                       ├── fs (file system)
                       ├── dialog (native dialogs)
                       ├── shell (open URLs)
                       └── updater (auto-update)
```

### Platform Detection

Use `isTauri()` from `@/shared/utils/platform` to conditionally enable desktop-only features:

```typescript
import { isTauri } from '@/shared/utils/platform';

if (isTauri()) {
  // Desktop-only: use native file dialog
  const { open } = await import('@tauri-apps/plugin-dialog');
  const file = await open({ filters: [{ name: 'Text', extensions: ['txt'] }] });
} else {
  // Web fallback: use <input type="file">
}
```

### Development Workflow

```bash
npm run dev           # Web only (Vite at localhost:1420)
npm run dev:desktop   # Desktop (Tauri window + Vite HMR)
npm run build         # Web production build
npm run build:desktop # Desktop installer/executable
```

### Adding Custom Tauri Commands

1. Define the Rust command in the appropriate module under `src-tauri/src/ttc/` (or create a new module)
2. Re-export from `mod.rs` and register in `lib.rs` via `.invoke_handler(tauri::generate_handler![...])`
3. Call from React with `import { invoke } from '@tauri-apps/api/core'`
4. Always gate behind `isTauri()` so the web version doesn't break

### Registered Plugins

| Plugin | Purpose | Capability |
|--------|---------|------------|
| `tauri-plugin-shell` | Open external URLs | `shell:allow-open` |
| `tauri-plugin-dialog` | Native file open/save dialogs | `dialog:allow-open`, `dialog:allow-save` |
| `tauri-plugin-fs` | Read/write local files | Scoped to Documents, Downloads, Desktop, AppData |
| `tauri-plugin-updater` | Auto-update mechanism | `updater:default` |
| `tauri-plugin-notification` | Native OS notifications (upload complete/error) | `notification:default` |
| `tauri-plugin-log` | Debug logging (dev only) | — |

### Common Pitfalls

#### 6. Tauri Plugin Permissions
Tauri v2 uses a capabilities-based security model. Every plugin API call must be explicitly allowed in `src-tauri/capabilities/default.json`. If a Tauri API call silently fails, check the capabilities file first.

#### 7. Platform-Gated Code
Never call `@tauri-apps/api` or `@tauri-apps/plugin-*` directly at module top-level. Always use dynamic `import()` behind `isTauri()` to avoid crashes in the browser:

```typescript
// ✅ Good — lazy import behind platform check
if (isTauri()) {
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const content = await readTextFile(path);
}

// ❌ Bad — top-level import breaks web build
import { readTextFile } from '@tauri-apps/plugin-fs';
```

#### 8. TTC Session Cookie Management
The TTC session is stored both in-memory (`TtcSession` managed state) and on disk (`ttc_session.dat` in app data dir). Always use the `get_session()` helper from `client.rs` — never access `TtcSession` directly in command handlers.

#### 9. Tauri Managed State in TTC Backend
Three structs are registered as Tauri managed state for the TTC feature:
- `TtcClient` — shared `reqwest::Client` for connection pooling
- `TtcSession` — cookie-based session with disk persistence
- `TtcImageCache` — in-memory poster image cache (path → base64 data URI)

Access via `app.state::<TtcClient>()` etc. Do NOT create new `reqwest::Client` instances in commands.

#### 10. Cover Image Upload via IPC
Cover images are cropped in the browser canvas, converted to `Uint8Array`, then transferred to Rust via `Array.from(bytes)` for IPC serialization. The Rust side receives `Vec<u8>` and uploads as multipart form data. This works but is memory-intensive for large images.

## Roadmap Reference

See `docs/future_roadmap.md` for planned features:
- Virtual scrolling for large token sets
- Cloud dictionary synchronization
- AI-powered contextual translation
- WYSIWYG parallel editor
- Export to .docx format
- Desktop: native file system integration
- Desktop: system tray with quick actions
- Desktop: auto-update via GitHub releases
- Desktop: book upload & local library management
- Desktop: integrated book crawler
