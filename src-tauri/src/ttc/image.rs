use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use super::client::{get_client, TTC_BASE, USER_AGENT};

// ─── Image Cache ──────────────────────────────────────────

/// In-memory cache for proxied poster images (path → base64 data URI).
pub struct TtcImageCache {
    pub cache: Mutex<HashMap<String, String>>,
}

impl Default for TtcImageCache {
    fn default() -> Self {
        Self {
            cache: Mutex::new(HashMap::new()),
        }
    }
}

// ─── Image Proxy Command ──────────────────────────────────

#[tauri::command]
pub async fn ttc_proxy_image(app: AppHandle, path: String) -> Result<String, String> {
    // Check cache first
    {
        let cache = app.state::<TtcImageCache>();
        let guard = cache.cache.lock().unwrap();
        if let Some(data_uri) = guard.get(&path) {
            return Ok(data_uri.clone());
        }
    }

    let url = format!("{}{}", TTC_BASE, path);
    let client = get_client(&app);
    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Image fetch failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    let b64 = BASE64.encode(&bytes);
    let data_uri = format!("data:{};base64,{}", content_type, b64);

    // Store in cache
    {
        let cache = app.state::<TtcImageCache>();
        cache.cache.lock().unwrap().insert(path, data_uri.clone());
    }

    Ok(data_uri)
}

// ─── Read Local File Command ────────────────────────────────

#[tauri::command]
pub fn ttc_read_local_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Lỗi đọc file: {}", e))
}
