# TTC Multi-Account + User Data Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Several TTC accounts with a switcher (jobs pinned to their account), and desktop settings moved from webview localStorage to a file in the app data dir.

**Architecture:** Rust owns both files (`ttc_accounts.json`, `user_data.json`) behind managed state and small commands. The frontend gets account info without cookies; settings are read synchronously from an in-memory copy loaded before the first render.

**Tech Stack:** Tauri 2 (Rust, serde_json, reqwest), React 19, Vitest + testing-library.

Spec: `docs/superpowers/specs/2026-10-27-ttc-multi-account-and-user-data-design.md`.

## Global Constraints

- UI text in Vietnamese, code and docs in English; `@/` imports; no cross-feature imports.
- Cookies never cross IPC to the frontend.
- Every Rust file write: temp file + rename.
- After each task: `npm run lint`, `npx tsc --noEmit`, the touched tests; Rust: `cargo test --lib` in `src-tauri`.
- Web build keeps working (`isTauri()` gates every invoke).

## File Structure

| File | Responsibility |
|------|----------------|
| `src-tauri/src/fsutil.rs` (new) | `write_atomic(path, bytes)` |
| `src-tauri/src/user_store.rs` (new) | `user_data.json` state + 4 commands |
| `src-tauri/src/ttc/accounts.rs` (new) | Pure account list logic: file model, legacy migration, upsert/remove/switch, `/account` parsing |
| `src-tauri/src/ttc/session.rs` | Managed state `TtcSession { store: Mutex<AccountsFile> }`, login window, account commands |
| `src-tauri/src/ttc/client.rs` | `get_session`, new `get_session_for` |
| `src-tauri/src/ttc/chapters.rs`, `types.rs` | `account` on queued options, cookie per account |
| `src/shared/utils/persistentStore.ts` (new) | init/migrate/get/set over Rust or localStorage |
| `src/shared/hooks/usePersistentState.ts` (renamed from `useLocalStorage.ts`) | state hook over the store |
| `src/features/ttc-uploader/hooks/useTtcAuth.ts` | accounts, switch, add, logout |
| `src/features/ttc-uploader/components/AccountSwitcher.tsx` (new) | header menu |
| page, `useTtcChapters`, `DownloadAllModal`, queue displays | pass/show `account` |

---

### Task 1: Rust user store

**Files:** Create `src-tauri/src/fsutil.rs`, `src-tauri/src/user_store.rs`; modify `src-tauri/src/lib.rs`.

**Produces:** commands `user_store_load() -> Option<HashMap<String,String>>`, `user_store_import(items: HashMap<String,String>) -> bool` (false when the file already exists), `user_store_set(key, value)`, `user_store_remove(key)`; state `UserStore::load(app_data_dir)`.

- [ ] Tests (in `user_store.rs`, temp dir): missing file loads as None; import writes once and a second import returns false and keeps the first data; set/remove persist across a reload; a corrupt file loads as None but is not overwritten by import (renamed to `.corrupt` first).
- [ ] Run, see them fail; implement `UserStore { path, items: Mutex<Option<HashMap>> }` with `write_atomic`; register commands + `app.manage` in `setup`.
- [ ] `cargo test --lib user_store` passes.

### Task 2: Frontend persistent store + hook

**Files:** Create `src/shared/utils/persistentStore.ts` (+ test); rename `src/shared/hooks/useLocalStorage.ts` → `usePersistentState.ts`; modify `src/shared/hooks/index.ts`, `src/main.tsx`, `src/features/settings/context/SettingsContext.tsx`.

**Consumes:** Task 1 commands. **Produces:** `initPersistentStore(): Promise<void>`, `storeGet(key): string | null`, `storeSet(key, value): void`, `storeRemove(key): void`, `usePersistentState<T>(key, default)`.

- [ ] Tests (mock `@tauri-apps/api/core` and `isTauri`): first run copies every localStorage key through `user_store_import` and serves them; later run reads `user_store_load` and ignores localStorage; `storeSet` updates reads at once and sends sets in call order (second invoke starts after the first resolves); web mode reads/writes localStorage; a failing load falls back to localStorage so the app still starts.
- [ ] Implement; `main.tsx` awaits `initPersistentStore()` (errors swallowed) before `createRoot().render`.
- [ ] Existing settings tests still pass (they run in web mode).

### Task 3: Rust account model (pure)

**Files:** Create `src-tauri/src/ttc/accounts.rs`; modify `src-tauri/src/ttc/mod.rs`.

**Produces:**
```rust
pub struct TtcAccount { pub username: String, pub display_name: String, pub cookie: String, pub needs_login: bool }
pub struct AccountsFile { pub active: Option<String>, pub accounts: Vec<TtcAccount> }
pub struct AccountInfo { username, display_name, needs_login }      // serde camelCase
pub struct AccountsView { active: Option<String>, accounts: Vec<AccountInfo> }
impl AccountsFile {
  fn load(dir) -> Self            // ttc_accounts.json, else legacy ttc_session.dat (username "")
  fn save(&self, dir) -> Result
  fn view(&self) -> AccountsView
  fn active_cookie(&self) -> Option<String>
  fn cookie_for(&self, username: Option<&str>) -> Result<String, String>
  fn upsert(&mut self, account) // by username; also replaces the legacy "" entry with the same cookie
  fn remove(&mut self, username) // next account becomes active
  fn set_active(&mut self, username) -> Result
  fn mark_needs_login(&mut self, username, bool)
}
pub fn parse_account_page(html) -> Option<(String /*username*/, String /*display*/)>
```
- [ ] Tests: round trip; legacy migration (and `legacy_file_consumed` deletion helper); upsert updates cookie of an existing username and keeps order; legacy entry replaced; remove active picks the first remaining; `cookie_for(Some(unknown))` error names the account; `parse_account_page` on the real PAGE_DATA shape (`socketUsername` + `displayName`, JSON string escapes).
- [ ] Implement; `cargo test --lib accounts` passes.

### Task 4: Session commands on top of the model

**Files:** Modify `src-tauri/src/ttc/session.rs`, `client.rs`, `lib.rs`.

**Produces:** commands `ttc_list_accounts`, `ttc_verify_active`, `ttc_open_login`, `ttc_check_session -> Option<AccountsView>`, `ttc_switch_account(username) -> AccountsView`, `ttc_logout(username: Option<String>) -> AccountsView`; `get_session_for(app, Option<&str>)`. Remove `ttc_get_session`, `ttc_verify_session`.

- [ ] `fetch_account_identity(client, base, cookie) -> Result<Option<(user, display)>>` (GET `/account`, `parse_account_page`); used by `ttc_check_session` and by `ttc_verify_active` when the username is empty.
- [ ] `ttc_open_login` clears webview cookies first.
- [ ] `cargo test --lib` + clippy clean for new code.

### Task 5: Pin queued jobs to an account

**Files:** Modify `src-tauri/src/ttc/types.rs`, `chapters.rs`; `src/features/ttc-uploader/types.ts`, `src/shared/types/download.ts`, `hooks/useTtcChapters.ts`, `components/DownloadAllModal.tsx`, `src/shared/components/UploadQueueManager.tsx`, `DownloadQueueManager.tsx`, `src/features/downloads/DownloadsPage.tsx`.

- [ ] Rust: `#[serde(default)] pub account: Option<String>` on `UploadOptions`, `DownloadAllOptions`; `ttc_fetch_chapters` and `ttc_download_chapter` take `account: Option<String>`; upload and download-all use `get_session_for(&app, options.account.as_deref())` and pass it down.
- [ ] TS: `account?: string` on both option types; `useTtcChapters(selectedBook, account)` and `DownloadAllModal account` set it; queue rows show `@account`.
- [ ] Test: `useTtcChapters.test.tsx` asserts the enqueued options carry the account.

### Task 6: Auth hook + AccountSwitcher + page

**Files:** Modify `hooks/useTtcAuth.ts`, `TtcUploaderPage.tsx`; create `components/AccountSwitcher.tsx` (+ test), export in `components/index.ts`.

**Produces:** `useTtcAuth() -> { accounts: AccountInfo[], active: AccountInfo | null, checkingSession, loggingIn, addAccount(), switchAccount(username), logout(username?) }`.

- [ ] Tests (`AccountSwitcher.test.tsx`): shows the active display name; lists others with "Cần đăng nhập lại" when `needsLogin`; clicking another calls `onSwitch(username)`; "Thêm tài khoản" and "Đăng xuất tài khoản này" call their handlers.
- [ ] Page: `useTtcBooks(active?.username)`; switching clears `selectedBook`, edit/create/delete modals, list notice; header uses `AccountSwitcher`; `LoginView` when no account; a `needsLogin` active account shows a banner with "Đăng nhập lại".

### Task 7: Docs + full verification

- [ ] `AGENTS.md` (pitfall 8, Rust module list, storage note), `docs/ttc_uploader_tech.md` (accounts section).
- [ ] `cargo test --lib`, `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vite build`.
