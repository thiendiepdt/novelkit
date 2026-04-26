use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use super::client::{get_client, TTC_BASE, USER_AGENT};

const SESSION_FILE: &str = "ttc_session.dat";

// ─── Session State ─────────────────────────────────────────

pub struct TtcSession {
    pub cookie: Mutex<Option<String>>,
}

impl TtcSession {
    /// Load session from disk on startup, or default to None.
    pub fn load(app_data_dir: &PathBuf) -> Self {
        let cookie = load_session_from_disk(app_data_dir);
        Self {
            cookie: Mutex::new(cookie),
        }
    }
}

// ─── Session Persistence Helpers ──────────────────────────

fn session_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join(SESSION_FILE))
}

fn save_session_to_disk(app: &AppHandle, session: &str) {
    if let Some(path) = session_file_path(app) {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        std::fs::write(&path, session).ok();
    }
}

fn load_session_from_disk(app_data_dir: &PathBuf) -> Option<String> {
    let path = app_data_dir.join(SESSION_FILE);
    std::fs::read_to_string(&path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn delete_session_from_disk(app: &AppHandle) {
    if let Some(path) = session_file_path(app) {
        std::fs::remove_file(&path).ok();
    }
}

// ─── Login Commands ────────────────────────────────────────

#[tauri::command]
pub async fn ttc_open_login(app: AppHandle) -> Result<(), String> {
    // Close existing login window if any
    if let Some(w) = app.get_webview_window("ttc-login") {
        w.close().ok();
    }

    let login_url = format!("{}/login", TTC_BASE);
    WebviewWindowBuilder::new(
        &app,
        "ttc-login",
        WebviewUrl::External(login_url.parse().unwrap()),
    )
    .title("Đăng nhập TiemTruyenChu")
    .inner_size(1100.0, 750.0)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn ttc_check_session(app: AppHandle) -> Result<Option<String>, String> {
    let login_window = match app.get_webview_window("ttc-login") {
        Some(w) => w,
        None => {
            // Login window was closed — check if we already have a session
            let state = app.state::<TtcSession>();
            let cookie = state.cookie.lock().unwrap().clone();
            return Ok(cookie);
        }
    };

    // Try to extract session cookie from the login webview
    let url: url::Url = TTC_BASE.parse().unwrap();
    let cookies = login_window
        .cookies_for_url(url)
        .map_err(|e| format!("Failed to read cookies: {}", e))?;

    for cookie in &cookies {
        if cookie.name() == "session" {
            let session_value = cookie.value().to_string();

            // Store in state + persist to disk
            let state = app.state::<TtcSession>();
            *state.cookie.lock().unwrap() = Some(session_value.clone());
            save_session_to_disk(&app, &session_value);

            // Close login window
            login_window.close().ok();

            return Ok(Some(session_value));
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn ttc_get_session(app: AppHandle) -> Result<Option<String>, String> {
    let state = app.state::<TtcSession>();
    let cookie = state.cookie.lock().unwrap().clone();
    Ok(cookie)
}

#[tauri::command]
pub async fn ttc_logout(app: AppHandle) -> Result<(), String> {
    let state = app.state::<TtcSession>();
    *state.cookie.lock().unwrap() = None;
    delete_session_from_disk(&app);

    // Close login window if open
    if let Some(w) = app.get_webview_window("ttc-login") {
        w.close().ok();
    }

    Ok(())
}

/// Verify the current session is still valid by hitting the TTC API.
/// Returns `true` if the session works, `false` if expired/invalid.
#[tauri::command]
pub async fn ttc_verify_session(app: AppHandle) -> Result<bool, String> {
    let state = app.state::<TtcSession>();
    let session = match state.cookie.lock().unwrap().clone() {
        Some(s) => s,
        None => return Ok(false),
    };

    let client = get_client(&app);
    let url = format!("{}/my-stories?limit=1&ajax=true", TTC_BASE);
    let resp = client
        .get(&url)
        .header("Cookie", format!("session={}", session))
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    Ok(resp.status().is_success())
}
