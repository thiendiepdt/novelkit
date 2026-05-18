use serde::Deserialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use url::Url;

use super::session::TtcSession;

pub const TTC_EDGE_URL: &str = "https://ttc-edge.khotangtruyen.org";
pub const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

#[derive(Debug, Deserialize)]
struct TtcEdgeResponse {
    domain: String,
}

/// Shared HTTP client managed as Tauri state.
/// Reuses connections via connection pooling instead of creating
/// a new `reqwest::Client` per command.
pub struct TtcClient {
    pub inner: reqwest::Client,
    base_url: Mutex<Option<String>>,
}

impl Default for TtcClient {
    fn default() -> Self {
        Self {
            inner: reqwest::Client::new(),
            base_url: Mutex::new(None),
        }
    }
}

impl TtcClient {
    async fn resolve_base_url(&self) -> Result<String, String> {
        if let Some(base_url) = self.base_url.lock().unwrap().clone() {
            return Ok(base_url);
        }

        let edge: TtcEdgeResponse = self
            .inner
            .get(TTC_EDGE_URL)
            .header("User-Agent", USER_AGENT)
            .send()
            .await
            .map_err(|e| format!("Không lấy được domain TTC từ edge API: {}", e))?
            .error_for_status()
            .map_err(|e| format!("Edge API trả lỗi khi lấy domain TTC: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Không đọc được domain TTC từ edge API: {}", e))?;

        let base_url = normalize_ttc_base_url(&edge.domain)?;
        *self.base_url.lock().unwrap() = Some(base_url.clone());
        Ok(base_url)
    }
}

fn normalize_ttc_base_url(domain: &str) -> Result<String, String> {
    let trimmed = domain.trim().trim_end_matches('/');
    let url = Url::parse(trimmed).map_err(|e| format!("Domain TTC không hợp lệ: {}", e))?;

    if url.scheme() != "https" {
        return Err("Domain TTC từ edge API phải dùng https".to_string());
    }

    if url.host_str().is_none() {
        return Err("Domain TTC từ edge API thiếu host".to_string());
    }

    Ok(trimmed.to_string())
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

/// Resolve the current TTC base URL from the edge API and cache it for this app run.
pub async fn get_ttc_base(app: &AppHandle) -> Result<String, String> {
    app.state::<TtcClient>().resolve_base_url().await
}
