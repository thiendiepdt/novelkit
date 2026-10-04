use regex::Regex;
use tauri::AppHandle;

use super::client::{get_client, get_session, get_ttc_base, USER_AGENT};
use super::types::{TtcBooksResponse, TtcCreateStoryResponse};

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
    let base_url = get_ttc_base(&app).await?;
    let url = format!(
        "{}/my-stories?keyword={}&status={}&page={}&limit={}&sortBy=updated_at&sortDir=desc&ajax=true",
        base_url,
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

    let base_url = get_ttc_base(&app).await?;
    let url = format!("{}{}", base_url, path);
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

    let base_url = get_ttc_base(&app).await?;
    let url = format!("{}{}", base_url, path);

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

// ─── Create Story Command ─────────────────────────────────

/// TTC answers the create form with JSON when asked to (`Accept: application/json`):
/// `{ success, message?, redirectUrl? }`. Anything else (usually the HTML login page
/// after the session expired) is reported as an error instead of a silent success.
fn parse_create_story_response(status: u16, body: &str) -> Result<TtcCreateStoryResponse, String> {
    serde_json::from_str::<TtcCreateStoryResponse>(body).map_err(|_| {
        format!(
            "TTC trả về dữ liệu không mong đợi (HTTP {}). Có thể phiên đăng nhập đã hết hạn, hãy đăng nhập lại.",
            status
        )
    })
}

/// Submit TTC's "Đăng Truyện Mới" form (`POST /dang-truyen`, multipart, text fields only).
/// The cover is uploaded afterwards with `ttc_upload_cover`, like the site's own flow.
#[tauri::command]
pub async fn ttc_create_story(
    app: AppHandle,
    fields: Vec<(String, String)>,
) -> Result<TtcCreateStoryResponse, String> {
    let session = get_session(&app)?;

    let base_url = get_ttc_base(&app).await?;
    let url = format!("{}/dang-truyen", base_url);

    let mut form = reqwest::multipart::Form::new();
    for (k, v) in fields {
        form = form.text(k, v);
    }

    let client = get_client(&app);
    let resp = client
        .post(&url)
        .header("Cookie", format!("session={}", session))
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .header("Origin", &base_url)
        .header("Referer", &url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Không gửi được yêu cầu đăng truyện: {}", e))?;

    let status = resp.status().as_u16();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("Không đọc được phản hồi của TTC: {}", e))?;

    parse_create_story_response(status, &body)
}

// ─── Delete Story Command ─────────────────────────────────

/// The session's CSRF token. `/my-stories` does not carry one, so it is read from the
/// create-story form, which every logged-in account can open.
fn extract_csrf_token(html: &str) -> Option<String> {
    Regex::new(r#"name="?_csrf"?\s+value="([^"]+)""#)
        .unwrap()
        .captures(html)
        .map(|caps| caps[1].to_string())
}

/// One flash message of a TTC page: `window.PAGE_DATA = { successMsg: "..." | null, ... }`.
fn page_data_message(html: &str, key: &str) -> Option<String> {
    let pattern = format!(r#"{}:\s*("(?:[^"\\]|\\.)*")"#, regex::escape(key));
    let caps = Regex::new(&pattern).ok()?.captures(html)?;
    // The value is a JS string literal; JSON decoding handles its escapes.
    serde_json::from_str::<String>(&caps[1])
        .ok()
        .map(|message| message.trim().to_string())
        .filter(|message| !message.is_empty())
}

/// TTC answers a delete with a redirect to `/my-stories` and reports the outcome there as a
/// flash message. `Ok(Some(msg))` = TTC confirmed, `Ok(None)` = the page said nothing either
/// way (the caller should re-check the list), `Err(msg)` = TTC refused.
fn interpret_delete_result(status: u16, html: &str) -> Result<Option<String>, String> {
    if let Some(message) = page_data_message(html, "errorMsg") {
        return Err(message);
    }
    if let Some(message) = page_data_message(html, "successMsg") {
        return Ok(Some(message));
    }
    if (200..300).contains(&status) {
        return Ok(None);
    }
    Err(format!(
        "TTC từ chối yêu cầu xóa truyện (HTTP {}). Có thể phiên đăng nhập đã hết hạn, hãy đăng nhập lại.",
        status
    ))
}

/// Delete one of the account's stories (`POST /xoa-truyen/{id}`).
///
/// The site no longer shows a button for this, but the route is still served; TTC itself
/// decides whether the story may be deleted and its answer is passed on unchanged.
/// Irreversible: the frontend must confirm with the user first.
#[tauri::command]
pub async fn ttc_delete_story(app: AppHandle, book_id: i64) -> Result<Option<String>, String> {
    let session = get_session(&app)?;
    let base_url = get_ttc_base(&app).await?;
    let client = get_client(&app);
    let cookie = format!("session={}", session);

    let form_page = client
        .get(format!("{}/dang-truyen", base_url))
        .header("Cookie", &cookie)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Không lấy được token từ TTC: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Không đọc được trang TTC: {}", e))?;
    let csrf_token = extract_csrf_token(&form_page).ok_or_else(|| {
        "Không tìm thấy token CSRF trên TTC (có thể phiên đăng nhập đã hết hạn)".to_string()
    })?;

    // reqwest follows the 302 to /my-stories as a GET on the same host (headers kept),
    // so the response read below is the landing page that carries the flash message.
    let resp = client
        .post(format!("{}/xoa-truyen/{}", base_url, book_id))
        .header("Cookie", &cookie)
        .header("User-Agent", USER_AGENT)
        .header("Origin", &base_url)
        .header("Referer", format!("{}/my-stories", base_url))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(format!("_csrf={}", urlencoding::encode(&csrf_token)))
        .send()
        .await
        .map_err(|e| format!("Không gửi được yêu cầu xóa truyện: {}", e))?;

    let status = resp.status().as_u16();
    let html = resp
        .text()
        .await
        .map_err(|e| format!("Không đọc được phản hồi của TTC: {}", e))?;

    interpret_delete_result(status, &html)
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

    let base_url = get_ttc_base(&app).await?;
    let url = format!("{}/upload-anh-bia/{}", base_url, book_id);
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

#[cfg(test)]
mod create_story_tests {
    use super::*;

    #[test]
    fn parses_success_with_redirect_to_cover_page() {
        let resp = parse_create_story_response(200, r#"{"success":true,"redirectUrl":"/upload-anh-bia/12345"}"#).unwrap();
        assert!(resp.success);
        assert_eq!(resp.redirect_url.as_deref(), Some("/upload-anh-bia/12345"));
        assert_eq!(resp.message, None);
    }

    #[test]
    fn parses_server_rejection_even_on_error_status() {
        let resp = parse_create_story_response(400, r#"{"success":false,"message":"Truyện đã tồn tại"}"#).unwrap();
        assert!(!resp.success);
        assert_eq!(resp.message.as_deref(), Some("Truyện đã tồn tại"));
    }

    #[test]
    fn html_response_is_an_error_not_a_silent_success() {
        let err = parse_create_story_response(200, "<!DOCTYPE html><html>login</html>").unwrap_err();
        assert!(err.contains("HTTP 200"));
        assert!(err.contains("đăng nhập"));
    }
}

#[cfg(test)]
mod delete_story_tests {
    use super::*;

    const LANDING: &str = r#"<script>
window.PAGE_DATA = Object.assign(window.PAGE_DATA || {}, {
    socketUsername: "thiendiepdt",
    successMsg: SUCCESS,
    errorMsg: ERROR,
    dbDown: false
});
</script>"#;

    fn landing(success: &str, error: &str) -> String {
        LANDING.replace("SUCCESS", success).replace("ERROR", error)
    }

    #[test]
    fn extracts_csrf_token_from_the_story_form() {
        let html = r#"<form id="storyForm"><input type="hidden" name="_csrf" value="1a3e4b82481b"></form>"#;
        assert_eq!(extract_csrf_token(html).as_deref(), Some("1a3e4b82481b"));
        assert_eq!(extract_csrf_token("<html>login</html>"), None);
    }

    #[test]
    fn error_flash_is_a_refusal_with_the_message_of_ttc() {
        // Captured from the live site for a story id that does not exist.
        let html = landing("null", r#""❌ Không tìm thấy truyện trên hệ thống!""#);
        assert_eq!(
            interpret_delete_result(200, &html),
            Err("❌ Không tìm thấy truyện trên hệ thống!".to_string())
        );
    }

    #[test]
    fn success_flash_confirms_the_delete() {
        let html = landing(r#""Đã xóa truyện \"A\" thành công""#, "null");
        assert_eq!(
            interpret_delete_result(200, &html),
            Ok(Some("Đã xóa truyện \"A\" thành công".to_string()))
        );
    }

    #[test]
    fn no_flash_on_a_served_page_is_unknown_not_success() {
        assert_eq!(interpret_delete_result(200, &landing("null", "null")), Ok(None));
    }

    #[test]
    fn error_status_without_a_message_is_a_refusal() {
        let err = interpret_delete_result(403, "Forbidden").unwrap_err();
        assert!(err.contains("HTTP 403"));
    }
}
