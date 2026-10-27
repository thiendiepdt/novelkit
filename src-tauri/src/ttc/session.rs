//! TTC accounts as managed state, the login window, and the account commands.
//!
//! The list itself (file format, migration, upsert/remove) lives in `accounts.rs`. Every
//! command that talks to TTC gets its cookie through `client::get_session` (active
//! account) or `client::get_session_for` (an account named by a queued job).

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use super::accounts::{parse_account_page, AccountsFile, AccountsView, TtcAccount};
use super::client::{get_client, get_ttc_base, USER_AGENT};

const LOGIN_WINDOW: &str = "ttc-login";

// ─── Session State ─────────────────────────────────────────

pub struct TtcSession {
    dir: PathBuf,
    store: Mutex<AccountsFile>,
}

impl TtcSession {
    /// Load the accounts from disk on startup (adopting a legacy single session).
    pub fn load(app_data_dir: &Path) -> Self {
        Self {
            dir: app_data_dir.to_path_buf(),
            store: Mutex::new(AccountsFile::load(app_data_dir)),
        }
    }

    /// Cookie of the named account (None = active).
    pub fn cookie_for(&self, username: Option<&str>) -> Result<String, String> {
        self.store.lock().unwrap().cookie_for(username)
    }

    fn view(&self) -> AccountsView {
        self.store.lock().unwrap().view()
    }

    /// Change the list and write it to disk in one step.
    fn update<R>(&self, change: impl FnOnce(&mut AccountsFile) -> R) -> Result<R, String> {
        let mut store = self.store.lock().unwrap();
        let result = change(&mut store);
        store.save(&self.dir)?;
        Ok(result)
    }
}

// ─── TTC lookups ───────────────────────────────────────────

/// Who a cookie belongs to, from the /account page. `Ok(None)` = TTC did not accept the
/// cookie (it answers with the login page); `Err` = TTC could not be reached.
async fn fetch_account_identity(
    client: &reqwest::Client,
    base_url: &str,
    cookie: &str,
) -> Result<Option<(String, String)>, String> {
    let resp = client
        .get(format!("{}/account", base_url))
        .header("Cookie", format!("session={}", cookie))
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Không kết nối được TTC: {}", e))?;
    if !resp.status().is_success() {
        return Ok(None);
    }
    let html = resp
        .text()
        .await
        .map_err(|e| format!("Không đọc được trang tài khoản TTC: {}", e))?;
    Ok(parse_account_page(&html))
}

/// Check the active account against TTC and record the outcome: a refused cookie marks
/// the account "needs login" (it is never deleted); an accepted one refreshes its name,
/// and gives a migrated legacy session its username. A network failure changes nothing.
async fn verify_active_account(app: &AppHandle) -> Result<AccountsView, String> {
    let state = app.state::<TtcSession>();
    let active: Option<TtcAccount> = state.store.lock().unwrap().active_account().cloned();
    let Some(account) = active else {
        return Ok(state.view());
    };

    let client = get_client(app);
    let base_url = get_ttc_base(app).await?;
    match fetch_account_identity(&client, &base_url, &account.cookie).await {
        Ok(Some((username, display_name))) => {
            state.update(|store| {
                store.upsert(TtcAccount {
                    username: username.clone(),
                    display_name,
                    cookie: account.cookie.clone(),
                    needs_login: false,
                });
                store.set_active(&username).ok();
            })?;
        }
        Ok(None) => state.update(|store| store.mark_needs_login(&account.username, true))?,
        Err(e) => log::warn!("Could not verify the TTC account: {}", e),
    }
    Ok(state.view())
}

// ─── Account Commands ──────────────────────────────────────

#[tauri::command]
pub fn ttc_list_accounts(app: AppHandle) -> AccountsView {
    app.state::<TtcSession>().view()
}

/// Startup check of the active account (see `verify_active_account`).
#[tauri::command]
pub async fn ttc_verify_active(app: AppHandle) -> Result<AccountsView, String> {
    verify_active_account(&app).await
}

#[tauri::command]
pub async fn ttc_switch_account(app: AppHandle, username: String) -> Result<AccountsView, String> {
    app.state::<TtcSession>()
        .update(|store| store.set_active(&username))??;
    verify_active_account(&app).await
}

/// Forget an account (default: the active one). The next account becomes active.
#[tauri::command]
pub async fn ttc_logout(app: AppHandle, username: Option<String>) -> Result<AccountsView, String> {
    let state = app.state::<TtcSession>();
    state.update(|store| {
        let target = username.or_else(|| store.active.clone());
        if let Some(target) = target {
            store.remove(&target);
        }
    })?;

    if let Ok(base_url) = get_ttc_base(&app).await {
        clear_webview_cookies(&app, &base_url);
    }
    if let Some(w) = app.get_webview_window(LOGIN_WINDOW) {
        w.close().ok();
    }
    Ok(state.view())
}

// ─── Login Window ──────────────────────────────────────────

/// Remove all TTC cookies from the shared webview cookie store, so the next login window
/// starts logged-out instead of reusing the account logged in last. The app keeps its
/// own copy of every account's cookie, so this logs nobody out of the app.
fn clear_webview_cookies(app: &AppHandle, base_url: &str) {
    let url = match base_url.parse::<url::Url>() {
        Ok(u) => u,
        Err(_) => return,
    };
    // The cookie store is shared across all webviews of the app, so any
    // window can be used to read and delete the cookies.
    for window in app.webview_windows().values() {
        if let Ok(cookies) = window.cookies_for_url(url.clone()) {
            for cookie in cookies {
                window.delete_cookie(cookie).ok();
            }
            return;
        }
    }
}

/// Open TTC's login page in its own window, logged out, to add (or log in again) an account.
#[tauri::command]
pub async fn ttc_open_login(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(LOGIN_WINDOW) {
        w.close().ok();
    }

    let base_url = get_ttc_base(&app).await?;
    clear_webview_cookies(&app, &base_url);
    let login_url = format!("{}/login", base_url);
    WebviewWindowBuilder::new(
        &app,
        LOGIN_WINDOW,
        WebviewUrl::External(login_url.parse().unwrap()),
    )
    .title("Đăng nhập TiemTruyenChu")
    .inner_size(1100.0, 750.0)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// State of the login window, polled by the frontend.
#[derive(Debug, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum LoginPoll {
    /// Still open, no valid session yet.
    Waiting,
    /// Closed by the user without logging in.
    Closed,
    /// Logged in: the account was added (or refreshed) and is now active.
    #[serde(rename_all = "camelCase")]
    Added { username: String, accounts: AccountsView },
}

#[tauri::command]
pub async fn ttc_check_session(app: AppHandle) -> Result<LoginPoll, String> {
    let Some(login_window) = app.get_webview_window(LOGIN_WINDOW) else {
        return Ok(LoginPoll::Closed);
    };

    let base_url = get_ttc_base(&app).await?;
    let url = base_url.parse::<url::Url>().map_err(|e| e.to_string())?;
    let cookies = login_window
        .cookies_for_url(url)
        .map_err(|e| format!("Failed to read cookies: {}", e))?;
    let Some(cookie) = cookies.iter().find(|c| c.name() == "session").map(|c| c.value().to_string()) else {
        return Ok(LoginPoll::Waiting);
    };

    // A session cookie exists before login too (anonymous session); /account tells them apart.
    let client = get_client(&app);
    let Some((username, display_name)) = fetch_account_identity(&client, &base_url, &cookie).await? else {
        return Ok(LoginPoll::Waiting);
    };

    let state = app.state::<TtcSession>();
    state.update(|store| {
        store.upsert(TtcAccount {
            username: username.clone(),
            display_name,
            cookie,
            needs_login: false,
        });
        store.set_active(&username).ok();
    })?;
    login_window.close().ok();

    Ok(LoginPoll::Added {
        username,
        accounts: state.view(),
    })
}
