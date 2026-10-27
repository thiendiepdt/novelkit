# TTC multi-account switcher + webview storage moved to user data

Date: 2026-10-27. Approved by the owner in chat ("Chuyển tài khoản", "OK, làm đi").

## 1. Multiple TTC accounts, one active at a time

### Goal

Keep several TiemTruyenChu accounts logged in and switch between them from a menu,
like the account switcher of Gmail or Slack. One account is shown at a time. Upload
and download jobs always run on the account that created them, even after a switch.

### Storage (Rust, `ttc/session.rs`)

- `ttc_accounts.json` in the app data dir replaces `ttc_session.dat`:
  `{ "active": "<username>" | null, "accounts": [{ "username", "displayName", "cookie", "needsLogin" }] }`.
  Written atomically (temp file + rename).
- Migration: when `ttc_accounts.json` is missing and `ttc_session.dat` exists, the old
  cookie becomes one account with an empty username, marked active. The first
  verification reads its username from `/account`, then the old file is deleted.
- Identity: `/account` carries `socketUsername: "..."` (stable id) and
  `displayName: "..."` in `window.PAGE_DATA`. Accounts are keyed by username.
- Cookies never leave Rust. The frontend gets `{ username, displayName, needsLogin }`
  per account plus the active username.
- `get_session(app)` keeps its signature and returns the active account's cookie, so the
  existing commands are unchanged. `get_session_for(app, Option<&str>)` returns the cookie
  of a named account (None = active).

### Commands

| Command | Does |
|---------|------|
| `ttc_list_accounts` | Accounts + active, no network |
| `ttc_verify_active` | Verifies the active cookie (fills a missing username); an expired one is marked `needsLogin`, never deleted |
| `ttc_open_login` | Clears the TTC cookies of the shared webview store, then opens the login window (so it never silently reuses the previous account) |
| `ttc_check_session` | Polled while the login window is open: on a valid cookie, reads `/account`, adds or updates that username, makes it active, closes the window |
| `ttc_switch_account(username)` | Makes it active and verifies it |
| `ttc_logout(username?)` | Removes that account (default: active); the next one becomes active |

Queued work is pinned: `UploadOptions` and `DownloadAllOptions` gain `account`
(username, set when the job is enqueued). `ttc_upload_chapters`, `ttc_download_all_chapters`,
`ttc_fetch_chapters` and `ttc_download_chapter` resolve the cookie with `get_session_for`.
A job whose account was removed fails with a message naming the account.

### Frontend

- `useTtcAuth` returns accounts, the active one, and add / switch / logout actions.
- `AccountSwitcher` replaces the "Đã đăng nhập TiemTruyenChu" box: the active account,
  a dropdown with the other accounts ("cần đăng nhập lại" badge), "Thêm tài khoản",
  "Đăng xuất tài khoản này". `LoginView` stays for zero accounts.
- Switching reloads the book list and closes the book detail view and open modals.
- Upload and download jobs record the active username; the queues show it per job.

## 2. Webview localStorage moved to the user data dir

### Goal

On desktop, nothing the app keeps should live only in the webview's localStorage
(cleared with the WebView2 profile, invisible to backups). Today that is
`nk_global_settings` (including AI API keys) and `nk_book_settings`.

### Design

- Rust `user_store.rs`: `user_data.json` in the app data dir,
  `{ "version": 1, "items": { "<key>": "<string value>" } }`, atomic writes.
  Commands: `user_store_load` (null when the file does not exist yet),
  `user_store_import(items)` (first run only, refuses to overwrite), `user_store_set(key, value)`,
  `user_store_remove(key)`.
- Frontend `shared/utils/persistentStore.ts`: `initPersistentStore()` runs in `main.tsx`
  before the first render. On desktop it loads the file into an in-memory map; on the first
  run (no file) it copies **every** localStorage key into it. Reads are synchronous from the
  map; writes update the map and are sent to Rust in order (one promise chain). The web
  build keeps using localStorage.
- `useLocalStorage` becomes `usePersistentState` on top of that store (same value encoding).
- localStorage is left as it was after the copy, so an older version still finds its data.

## Testing

- Rust: accounts file round trip, legacy migration, upsert by username, removal and next
  active, `/account` parsing, `get_session_for`; user store load / import-once / set / remove.
- Frontend: persistent store (migration copies all keys, write ordering, web fallback),
  `AccountSwitcher` (switch, add, logout, needs-login badge), jobs carrying the account.
