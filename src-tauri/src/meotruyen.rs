//! Mèo Truyện (meotruyen.com): the import API, called with an uploader token (`mtk_…`).
//!
//! The same session API as the site's own `npm run import` (docs/import-format.md in the
//! meotruyen repo): open a job with the book and its table of contents, send the chapter
//! texts in batches, finalize. Payloads are built and checked in the frontend
//! (`ttc-uploader/meotruyen`); this module only carries them.
//!
//! The token goes to one place only: the `Authorization` header of requests to
//! `MEOTRUYEN_ORIGIN` (fixed here, never taken from the caller). It is never put in a URL,
//! an error message or a log line. reqwest drops the header on a redirect to another host.

use serde::Serialize;
use serde_json::Value;
use std::time::Duration;
use tauri::AppHandle;

use crate::net::describe_request_error;
use crate::ttc::client::get_client;

pub const MEOTRUYEN_ORIGIN: &str = "https://meotruyen.com";
/// Used when the token field of the settings is empty, like the site's import script.
pub const TOKEN_ENV: &str = "MEOTRUYEN_TOKEN";

const REQUEST_TIMEOUT: Duration = Duration::from_secs(90);

/// A failed call, shaped like the site's `{ error: { code, message, details } }`.
/// `status` is 0 when the site was not reached at all.
#[derive(Debug, Serialize, PartialEq)]
pub struct MeoError {
    pub status: u16,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl MeoError {
    fn new(status: u16, code: &str, message: impl Into<String>) -> Self {
        Self {
            status,
            code: code.to_string(),
            message: message.into(),
            details: None,
        }
    }
}

/// Token of the settings when there is one, else the environment's.
fn pick_token(given: &str, env: Option<String>) -> Option<String> {
    let given = given.trim();
    if !given.is_empty() {
        return Some(given.to_string());
    }
    env.map(|t| t.trim().to_string()).filter(|t| !t.is_empty())
}

fn env_token() -> Option<String> {
    std::env::var(TOKEN_ENV).ok()
}

fn resolve_token(given: &str) -> Result<String, MeoError> {
    let token = pick_token(given, env_token()).ok_or_else(|| {
        MeoError::new(
            0,
            "no_token",
            format!(
                "Chưa có token Mèo Truyện: nhập ở Cài đặt → Mèo Truyện, hoặc đặt biến môi trường {}.",
                TOKEN_ENV
            ),
        )
    })?;
    // A header value cannot hold control characters; a pasted token with one is not a token.
    if !token.chars().all(|c| c.is_ascii_graphic()) {
        return Err(MeoError::new(
            0,
            "bad_token",
            "Token Mèo Truyện có ký tự lạ (khoảng trắng, xuống dòng...).",
        ));
    }
    Ok(token)
}

/// Job ids go into the path: only the characters the site uses for them.
fn valid_job_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 100
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// The `data` of a reply, or its `error` as a `MeoError`.
fn parse_reply(status: u16, body: &str) -> Result<Value, MeoError> {
    let bad = || {
        MeoError::new(
            status,
            "bad_response",
            format!("Mèo Truyện trả dữ liệu không đọc được (HTTP {}).", status),
        )
    };
    let parsed: Value = serde_json::from_str(body).map_err(|_| bad())?;
    if let Some(error) = parsed.get("error").filter(|e| !e.is_null()) {
        return Err(MeoError {
            status,
            code: error
                .get("code")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_string(),
            message: error
                .get("message")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| format!("HTTP {}", status)),
            details: error.get("details").cloned().filter(|d| !d.is_null()),
        });
    }
    parsed
        .get("data")
        .cloned()
        .filter(|d| !d.is_null())
        .ok_or_else(bad)
}

async fn call(
    app: &AppHandle,
    method: reqwest::Method,
    path: &str,
    token: Option<&str>,
    body: Option<&Value>,
) -> Result<Value, MeoError> {
    let mut request = get_client(app)
        .request(method, format!("{}{}", MEOTRUYEN_ORIGIN, path))
        .timeout(REQUEST_TIMEOUT)
        .header("Accept", "application/json")
        .header(
            "User-Agent",
            concat!("NovelKit/", env!("CARGO_PKG_VERSION")),
        );
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    if let Some(body) = body {
        request = request.json(body);
    }
    let response = request.send().await.map_err(|e| {
        MeoError::new(
            0,
            "network",
            format!(
                "Không kết nối được Mèo Truyện: {}.",
                describe_request_error(&e)
            ),
        )
    })?;
    let status = response.status().as_u16();
    let text = response.text().await.map_err(|e| {
        MeoError::new(
            status,
            "network",
            format!(
                "Không đọc được trả lời của Mèo Truyện: {}.",
                describe_request_error(&e)
            ),
        )
    })?;
    parse_reply(status, &text)
}

fn job_path(job_id: &str, rest: &str) -> Result<String, MeoError> {
    if !valid_job_id(job_id) {
        return Err(MeoError::new(0, "bad_job", "Mã phiên nạp không hợp lệ."));
    }
    Ok(format!("/api/admin/imports/{}{}", job_id, rest))
}

/// Where the token would come from: "settings", "env" or "none". Never returns the token.
#[tauri::command]
pub fn meotruyen_token_source(token: String) -> String {
    if !token.trim().is_empty() {
        "settings".into()
    } else if pick_token("", env_token()).is_some() {
        "env".into()
    } else {
        "none".into()
    }
}

/// Genres and tags of the site (`/api/genres`, public).
#[tauri::command]
pub async fn meotruyen_genres(app: AppHandle) -> Result<Value, MeoError> {
    call(&app, reqwest::Method::GET, "/api/genres", None, None).await
}

/// Open an import job: book fields, table of contents, cover (`AdminImportOpenInput`).
#[tauri::command]
pub async fn meotruyen_import_open(
    app: AppHandle,
    token: String,
    input: Value,
) -> Result<Value, MeoError> {
    let token = resolve_token(&token)?;
    call(
        &app,
        reqwest::Method::POST,
        "/api/admin/imports",
        Some(&token),
        Some(&input),
    )
    .await
}

/// Send one batch of chapter texts (at most 100 chapters and 4 MB).
#[tauri::command]
pub async fn meotruyen_import_send(
    app: AppHandle,
    token: String,
    job_id: String,
    chapters: Value,
) -> Result<Value, MeoError> {
    let token = resolve_token(&token)?;
    let path = job_path(&job_id, "/chapters")?;
    let body = serde_json::json!({ "chapters": chapters });
    call(&app, reqwest::Method::PUT, &path, Some(&token), Some(&body)).await
}

/// Finalize the job: the site creates (or overwrites) the book and every chapter at once.
#[tauri::command]
pub async fn meotruyen_import_finalize(
    app: AppHandle,
    token: String,
    job_id: String,
) -> Result<Value, MeoError> {
    let token = resolve_token(&token)?;
    let path = job_path(&job_id, "/finalize")?;
    call(
        &app,
        reqwest::Method::POST,
        &path,
        Some(&token),
        Some(&serde_json::json!({})),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn settings_token_wins_over_the_environment() {
        assert_eq!(
            pick_token(" mtk_a ", Some("mtk_env".into())),
            Some("mtk_a".into())
        );
        assert_eq!(
            pick_token("  ", Some(" mtk_env\n".into())),
            Some("mtk_env".into())
        );
        assert_eq!(pick_token("", Some("   ".into())), None);
        assert_eq!(pick_token("", None), None);
    }

    #[test]
    fn job_ids_cannot_leave_the_imports_path() {
        assert!(valid_job_id("3f2a9c1e-77b0-4d1a-9e55-0b6f1c2d3e4f"));
        assert!(!valid_job_id(""));
        assert!(!valid_job_id("../tokens"));
        assert!(!valid_job_id("a/finalize"));
        assert!(!valid_job_id("a?x=1"));
        assert_eq!(
            job_path("abc", "/chapters").unwrap(),
            "/api/admin/imports/abc/chapters"
        );
        assert_eq!(job_path("../x", "/chapters").unwrap_err().code, "bad_job");
    }

    #[test]
    fn reply_data_and_errors() {
        assert_eq!(
            parse_reply(201, r#"{"data":{"jobId":"j1","slug":"s"}}"#).unwrap(),
            json!({"jobId":"j1","slug":"s"})
        );

        let dup = parse_reply(
            409,
            r#"{"error":{"code":"duplicate_book","message":"Đã có truyện trùng","details":{"matches":[{"id":7}]}}}"#,
        )
        .unwrap_err();
        assert_eq!(dup.status, 409);
        assert_eq!(dup.code, "duplicate_book");
        assert_eq!(dup.message, "Đã có truyện trùng");
        assert_eq!(dup.details, Some(json!({"matches":[{"id":7}]})));

        let bare = parse_reply(404, r#"{"error":{}}"#).unwrap_err();
        assert_eq!(
            (bare.code.as_str(), bare.message.as_str(), bare.details),
            ("unknown", "HTTP 404", None)
        );

        assert_eq!(
            parse_reply(502, "<html>Bad gateway</html>")
                .unwrap_err()
                .code,
            "bad_response"
        );
        assert_eq!(
            parse_reply(200, r#"{"ok":true}"#).unwrap_err().code,
            "bad_response"
        );
    }

    #[test]
    fn errors_serialize_like_the_site() {
        let e = MeoError::new(0, "network", "x");
        assert_eq!(
            serde_json::to_value(&e).unwrap(),
            json!({"status":0,"code":"network","message":"x"})
        );
    }
}
