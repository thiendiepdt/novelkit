use tauri::{AppHandle, Manager};

use super::session::TtcSession;

pub const TTC_BASE: &str = "https://tiemtruyenchu.com";
pub const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/// Shared HTTP client managed as Tauri state.
/// Reuses connections via connection pooling instead of creating
/// a new `reqwest::Client` per command.
pub struct TtcClient {
    pub inner: reqwest::Client,
}

impl Default for TtcClient {
    fn default() -> Self {
        Self {
            inner: reqwest::Client::new(),
        }
    }
}

// ─── Helper: extract session from state ───────────────────

/// Shorthand to extract the session cookie from `TtcSession` managed state.
/// Returns `Err("Chưa đăng nhập")` if no session is present.
pub fn get_session(app: &AppHandle) -> Result<String, String> {
    let state = app.state::<TtcSession>();
    let cookie = state.cookie.lock().unwrap().clone();
    cookie.ok_or_else(|| "Chưa đăng nhập".to_string())
}

/// Shorthand to get the shared `reqwest::Client` from Tauri state.
pub fn get_client(app: &AppHandle) -> reqwest::Client {
    app.state::<TtcClient>().inner.clone()
}
