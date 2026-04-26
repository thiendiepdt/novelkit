use tauri::AppHandle;

use super::client::{get_client, get_session, TTC_BASE, USER_AGENT};
use super::types::TtcBooksResponse;

// ─── Fetch Books Command ──────────────────────────────────

#[tauri::command]
pub async fn ttc_fetch_books(
    app: AppHandle,
    page: Option<i64>,
    limit: Option<i64>,
    keyword: Option<String>,
    status: Option<String>,
) -> Result<TtcBooksResponse, String> {
    let session = get_session(&app)?;

    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(20);
    let keyword = keyword.unwrap_or_default();
    let status = status.unwrap_or_else(|| "ongoing".to_string());
    let url = format!(
        "{}/my-stories?keyword={}&status={}&page={}&limit={}&sortBy=updated_at&sortDir=desc&ajax=true",
        TTC_BASE,
        urlencoding::encode(&keyword),
        urlencoding::encode(&status),
        page,
        limit
    );

    let client = get_client(&app);
    let resp = client
        .get(&url)
        .header("Cookie", format!("session={}", session))
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let body: TtcBooksResponse = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(body)
}

// ─── Fetch HTML Command ──────────────────────────────────

#[tauri::command]
pub async fn ttc_fetch_html(app: AppHandle, path: String) -> Result<String, String> {
    let session = get_session(&app)?;

    let url = format!("{}{}", TTC_BASE, path);
    let client = get_client(&app);
    let resp = client
        .get(&url)
        .header("Cookie", format!("session={}", session))
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    resp.text()
        .await
        .map_err(|e| format!("Text parse failed: {}", e))
}

// ─── Submit Multipart Command ───────────────────────────────

#[tauri::command]
pub async fn ttc_submit_multipart(
    app: AppHandle,
    path: String,
    fields: Vec<(String, String)>,
) -> Result<String, String> {
    let session = get_session(&app)?;

    let url = format!("{}{}", TTC_BASE, path);

    let mut form = reqwest::multipart::Form::new();
    for (k, v) in fields {
        form = form.text(k, v);
    }

    let client = get_client(&app);
    let resp = client
        .post(&url)
        .header("Cookie", format!("session={}", session))
        .header("User-Agent", USER_AGENT)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Submit failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    resp.text()
        .await
        .map_err(|e| format!("Response parse failed: {}", e))
}

// ─── Upload Cover Command ─────────────────────────────────

#[tauri::command]
pub async fn ttc_upload_cover(
    app: AppHandle,
    book_id: i64,
    image_bytes: Vec<u8>,
    mime_type: String,
) -> Result<String, String> {
    let session = get_session(&app)?;

    let ext = match mime_type.as_str() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "jpg",
    };

    let file_name = format!("cover.{}", ext);

    let part = reqwest::multipart::Part::bytes(image_bytes)
        .file_name(file_name)
        .mime_str(&mime_type)
        .map_err(|e| format!("Lỗi tạo part: {}", e))?;

    let form = reqwest::multipart::Form::new().part("poster", part);

    let url = format!("{}/upload-anh-bia/{}", TTC_BASE, book_id);
    let client = get_client(&app);
    let resp = client
        .post(&url)
        .header("Cookie", format!("session={}", session))
        .header("User-Agent", USER_AGENT)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Upload failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    resp.text()
        .await
        .map_err(|e| format!("Response parse failed: {}", e))
}
