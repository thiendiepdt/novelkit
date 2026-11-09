use serde::Deserialize;
use std::sync::{Mutex, RwLock};
use tauri::{AppHandle, Manager};
use url::Url;

use super::session::TtcSession;

pub const TTC_EDGE_URL: &str = "https://ttc-edge.khotangtruyen.org";

/// User-Agent of TTC requests until the webview reports its own (`ttc_set_user_agent`), or
/// when the one it reports does not look like a browser. TTC filters the requests of its
/// upload and create-story pages by User-Agent: it must be a complete browser string.
pub const FALLBACK_USER_AGENT: &str = if cfg!(target_os = "windows") {
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
} else if cfg!(target_os = "macos") {
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
} else {
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
};

/// A User-Agent a real browser could send: "Mozilla/5.0 (platform) …" with a browser product
/// token, printable ASCII, of a sane length. The macOS WKWebView, for one, reports no
/// "Safari/" token and fails this; the fallback is used then.
pub fn is_browser_user_agent(ua: &str) -> bool {
    (40..=512).contains(&ua.len())
        && ua.bytes().all(|b| (0x20..0x7f).contains(&b))
        && ua.starts_with("Mozilla/5.0 (")
        && ["Chrome/", "Firefox/", "Safari/"]
            .iter()
            .any(|token| ua.contains(token))
}

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
    /// Sent as the User-Agent of every TTC request: the webview's own when it looks like a browser.
    user_agent: RwLock<String>,
}

/// Build the app's HTTP client.
///
/// Obsolete multi-line ("folded") response headers are accepted: www.qimao.com sends
/// header lines that start with a space, which hyper rejects by default with
/// "invalid HTTP header parsed" while browsers and curl simply read on.
pub fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .http1_allow_obsolete_multiline_headers_in_responses(true)
        .build()
        // Same failure mode as `reqwest::Client::new()`: only the TLS backend can fail to initialize.
        .expect("failed to initialize the HTTP client")
}

impl Default for TtcClient {
    fn default() -> Self {
        Self {
            inner: build_http_client(),
            base_url: Mutex::new(None),
            user_agent: RwLock::new(FALLBACK_USER_AGENT.to_string()),
        }
    }
}

impl TtcClient {
    pub fn user_agent(&self) -> String {
        self.user_agent.read().unwrap().clone()
    }

    /// Use `ua` for TTC requests if it looks like a browser's; returns whether it was taken.
    pub fn set_user_agent(&self, ua: &str) -> bool {
        let ua = ua.trim();
        if !is_browser_user_agent(ua) {
            return false;
        }
        *self.user_agent.write().unwrap() = ua.to_string();
        true
    }

    async fn resolve_base_url(&self) -> Result<String, String> {
        if let Some(base_url) = self.base_url.lock().unwrap().clone() {
            return Ok(base_url);
        }

        let edge: TtcEdgeResponse = self
            .inner
            .get(TTC_EDGE_URL)
            .header("User-Agent", self.user_agent())
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

/// Session cookie of the active account.
/// Returns `Err("Chưa đăng nhập")` when no account is active.
pub fn get_session(app: &AppHandle) -> Result<String, String> {
    get_session_for(app, None)
}

/// Session cookie of the named account, or of the active one for None. Queued jobs name
/// the account that created them, so a switch in between does not move them to another.
pub fn get_session_for(app: &AppHandle, username: Option<&str>) -> Result<String, String> {
    app.state::<TtcSession>().cookie_for(username)
}

/// User-Agent for a TTC request (see `TtcClient::user_agent`).
pub fn user_agent(app: &AppHandle) -> String {
    app.state::<TtcClient>().user_agent()
}

/// The webview reports `navigator.userAgent` at startup, before any TTC request: TTC requests
/// then carry the User-Agent of the browser engine the login window runs on. Returns the
/// User-Agent in use (the fallback when the reported one does not look like a browser).
#[tauri::command]
pub fn ttc_set_user_agent(app: AppHandle, user_agent: String) -> String {
    let client = app.state::<TtcClient>();
    if !client.set_user_agent(&user_agent) {
        log::warn!(
            "Webview User-Agent not used for TTC requests: {:?}",
            user_agent
        );
    }
    client.user_agent()
}

/// Shorthand to get the shared `reqwest::Client` from Tauri state.
pub fn get_client(app: &AppHandle) -> reqwest::Client {
    app.state::<TtcClient>().inner.clone()
}

/// Resolve the current TTC base URL from the edge API and cache it for this app run.
pub async fn get_ttc_base(app: &AppHandle) -> Result<String, String> {
    app.state::<TtcClient>().resolve_base_url().await
}

#[cfg(test)]
mod user_agent_tests {
    use super::*;

    #[test]
    fn fallback_is_a_browser_user_agent() {
        assert!(is_browser_user_agent(FALLBACK_USER_AGENT));
    }

    #[test]
    fn accepts_webview_user_agents_of_real_browsers() {
        // WebView2 (Windows)
        assert!(is_browser_user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0"
        ));
        // WebKitGTK (Linux)
        assert!(is_browser_user_agent(
            "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
        ));
    }

    #[test]
    fn rejects_truncated_or_odd_user_agents() {
        // The old NovelKit string: no browser product token.
        assert!(!is_browser_user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        ));
        // macOS WKWebView: no "Safari/" token.
        assert!(!is_browser_user_agent(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)"
        ));
        assert!(!is_browser_user_agent(""));
        assert!(!is_browser_user_agent("NovelKit/1.6.0"));
        assert!(!is_browser_user_agent(
            "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36\r\nX-Evil: 1"
        ));
    }

    #[test]
    fn keeps_the_fallback_when_the_reported_one_is_refused() {
        let client = TtcClient::default();
        assert!(!client
            .set_user_agent("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko)"));
        assert_eq!(client.user_agent(), FALLBACK_USER_AGENT);
        let edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";
        assert!(client.set_user_agent(&format!("  {edge} ")));
        assert_eq!(client.user_agent(), edge);
    }
}
