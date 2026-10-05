//! One-shot JSON generation through Gemini or any OpenAI-compatible endpoint.
//!
//! The request is made here rather than in the webview because OpenAI-compatible
//! hubs rarely send CORS headers. The prompt is built and the reply validated in
//! the frontend (`ttc-uploader/ai`); this module only speaks the two wire formats.

use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;
use tauri::AppHandle;

use crate::net::describe_request_error;
use crate::ttc::client::get_client;

pub const DEFAULT_GEMINI_BASE_URL: &str = "https://generativelanguage.googleapis.com";
pub const DEFAULT_OPENAI_BASE_URL: &str = "https://api.openai.com/v1";

const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

/// A reply cut off by the output limit is unusable here: the JSON is left open.
const TRUNCATED_REPLY: &str = "Model trả lời bị cắt giữa chừng vì chạm giới hạn độ dài. Hãy thử lại, hoặc dùng model / hub cho phép trả lời dài hơn.";

const GEMINI_SAFETY_CATEGORIES: [&str; 5] = [
    "HARM_CATEGORY_HARASSMENT",
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
    "HARM_CATEGORY_CIVIC_INTEGRITY",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequest {
    /// "gemini" or "openai" (OpenAI or any chat/completions-compatible hub).
    pub provider: String,
    pub api_key: String,
    pub model: String,
    /// Empty = the provider's official endpoint.
    pub base_url: String,
    pub system: String,
    pub user: String,
}

fn resolve_base_url(custom: &str, default: &str) -> String {
    let trimmed = custom.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        default.to_string()
    } else {
        trimmed.to_string()
    }
}

fn truncate_chars(s: &str, max: usize) -> String {
    let mut out: String = s.chars().take(max).collect();
    if s.chars().count() > max {
        out.push('…');
    }
    out
}

/// Human-readable reason from an error response: `error.message`, a string `error`, or the raw body.
fn api_error_message(body: &str) -> String {
    if let Ok(payload) = serde_json::from_str::<Value>(body) {
        // Some hubs wrap the error object in an array.
        let payload = payload.get(0).unwrap_or(&payload);
        if let Some(message) = payload.pointer("/error/message").and_then(Value::as_str) {
            return message.to_string();
        }
        if let Some(message) = payload.get("error").and_then(Value::as_str) {
            return message.to_string();
        }
        if let Some(message) = payload.get("message").and_then(Value::as_str) {
            return message.to_string();
        }
    }
    let trimmed = body.trim();
    if trimmed.is_empty() || trimmed.starts_with('<') {
        String::new()
    } else {
        truncate_chars(trimmed, 300)
    }
}

// ─── Gemini ────────────────────────────────────────────────

fn gemini_model(model: &str) -> &str {
    let model = model.trim();
    model.strip_prefix("models/").unwrap_or(model)
}

fn gemini_major(model: &str) -> Option<u32> {
    let rest = gemini_model(model).strip_prefix("gemini-")?;
    let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
    digits.parse().ok()
}

pub fn gemini_url(base_url: &str, model: &str) -> String {
    format!(
        "{}/v1beta/models/{}:generateContent",
        resolve_base_url(base_url, DEFAULT_GEMINI_BASE_URL),
        gemini_model(model)
    )
}

pub fn gemini_body(model: &str, system: &str, user: &str) -> Value {
    let mut generation = json!({ "responseMimeType": "application/json" });
    // Gemini 3.x is tuned for its default temperature; only older models get a low one.
    if gemini_major(model).is_none_or(|major| major < 3) {
        generation["temperature"] = json!(0.3);
    }
    let safety: Vec<Value> = GEMINI_SAFETY_CATEGORIES
        .iter()
        .map(|category| json!({ "category": category, "threshold": "OFF" }))
        .collect();
    json!({
        "systemInstruction": { "parts": [{ "text": system }] },
        "contents": [{ "role": "user", "parts": [{ "text": user }] }],
        "safetySettings": safety,
        "generationConfig": generation,
    })
}

/// Join every text part, skipping `thought` parts (3.x models may return reasoning first).
pub fn parse_gemini(payload: &Value) -> Result<String, String> {
    if let Some(message) = payload.pointer("/error/message").and_then(Value::as_str) {
        return Err(format!("Gemini báo lỗi: {}", message));
    }

    let text: String = payload
        .pointer("/candidates/0/content/parts")
        .and_then(Value::as_array)
        .map(|parts| {
            parts
                .iter()
                .filter(|part| part.get("thought").and_then(Value::as_bool) != Some(true))
                .filter_map(|part| part.get("text").and_then(Value::as_str))
                .collect()
        })
        .unwrap_or_default();
    if payload.pointer("/candidates/0/finishReason").and_then(Value::as_str) == Some("MAX_TOKENS") {
        return Err(TRUNCATED_REPLY.to_string());
    }
    if !text.trim().is_empty() {
        return Ok(text);
    }

    let blocked = payload
        .pointer("/promptFeedback/blockReason")
        .and_then(Value::as_str)
        .or_else(|| {
            payload
                .pointer("/candidates/0/finishReason")
                .and_then(Value::as_str)
                .filter(|reason| *reason != "STOP")
        });
    match blocked {
        Some(reason) => Err(format!("Gemini không trả lời (lý do: {})", reason)),
        None => Err("Gemini không trả về nội dung".to_string()),
    }
}

// ─── OpenAI-compatible ─────────────────────────────────────

pub fn openai_url(base_url: &str) -> String {
    format!(
        "{}/chat/completions",
        resolve_base_url(base_url, DEFAULT_OPENAI_BASE_URL)
    )
}

/// No `temperature`: GPT-5/o-series models only accept their default.
pub fn openai_body(model: &str, system: &str, user: &str) -> Value {
    json!({
        "model": model.trim(),
        "response_format": { "type": "json_object" },
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user },
        ],
    })
}

/// `message.content` is a string; a few hubs return an array of `{type:"text", text}` parts.
pub fn parse_openai(payload: &Value) -> Result<String, String> {
    if let Some(message) = payload.pointer("/error/message").and_then(Value::as_str) {
        return Err(format!("API báo lỗi: {}", message));
    }

    let text = match payload.pointer("/choices/0/message/content") {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(parts)) => parts
            .iter()
            .filter_map(|part| part.get("text").and_then(Value::as_str))
            .collect(),
        _ => String::new(),
    };
    if payload.pointer("/choices/0/finish_reason").and_then(Value::as_str) == Some("length") {
        return Err(TRUNCATED_REPLY.to_string());
    }
    if !text.trim().is_empty() {
        return Ok(text);
    }

    if let Some(refusal) = payload
        .pointer("/choices/0/message/refusal")
        .and_then(Value::as_str)
        .filter(|refusal| !refusal.is_empty())
    {
        return Err(format!("Model từ chối trả lời: {}", refusal));
    }
    if payload.pointer("/choices/0/finish_reason").and_then(Value::as_str) == Some("content_filter") {
        return Err("Model không trả lời (bị bộ lọc nội dung chặn)".to_string());
    }
    Err("Model không trả về nội dung".to_string())
}

// ─── Command ───────────────────────────────────────────────

/// Send one system + user prompt and return the model's raw text (expected to be JSON).
pub async fn generate_json(client: &reqwest::Client, request: &AiRequest) -> Result<String, String> {
    if request.api_key.trim().is_empty() {
        return Err("Chưa cấu hình API key cho AI (Cài đặt → AI)".to_string());
    }
    if request.model.trim().is_empty() {
        return Err("Chưa cấu hình model cho AI (Cài đặt → AI)".to_string());
    }

    let (label, builder) = match request.provider.as_str() {
        "gemini" => (
            "Gemini",
            client
                .post(gemini_url(&request.base_url, &request.model))
                .header("x-goog-api-key", request.api_key.trim())
                .json(&gemini_body(&request.model, &request.system, &request.user)),
        ),
        "openai" => (
            "OpenAI",
            client
                .post(openai_url(&request.base_url))
                .header("Authorization", format!("Bearer {}", request.api_key.trim()))
                .header("Accept", "application/json")
                .json(&openai_body(&request.model, &request.system, &request.user)),
        ),
        other => return Err(format!("Nhà cung cấp AI không hợp lệ: {}", other)),
    };

    let resp = builder
        .timeout(REQUEST_TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("Không gọi được {}: {}", label, describe_request_error(&e)))?;

    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("Không đọc được phản hồi từ {}: {}", label, e))?;

    if !status.is_success() {
        let reason = api_error_message(&body);
        return Err(if reason.is_empty() {
            format!("{} lỗi HTTP {}", label, status)
        } else {
            format!("{} lỗi HTTP {}: {}", label, status.as_u16(), reason)
        });
    }

    let payload: Value = serde_json::from_str(&body)
        .map_err(|_| format!("{} trả về dữ liệu không phải JSON", label))?;

    match request.provider.as_str() {
        "gemini" => parse_gemini(&payload),
        _ => parse_openai(&payload),
    }
}

#[tauri::command]
pub async fn ai_generate_json(app: AppHandle, request: AiRequest) -> Result<String, String> {
    generate_json(&get_client(&app), &request).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gemini_url_uses_default_base_and_strips_models_prefix() {
        assert_eq!(
            gemini_url("", "models/gemini-3.8-flash"),
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
        );
        assert_eq!(
            gemini_url(" https://proxy.example/gemini/ ", "gemini-2.5-flash"),
            "https://proxy.example/gemini/v1beta/models/gemini-2.5-flash:generateContent"
        );
    }

    #[test]
    fn gemini_body_asks_for_json_and_sets_temperature_only_before_3x() {
        let old = gemini_body("gemini-2.5-flash", "sys", "usr");
        assert_eq!(old["generationConfig"]["responseMimeType"], "application/json");
        assert_eq!(old["generationConfig"]["temperature"], 0.3);
        assert_eq!(old["systemInstruction"]["parts"][0]["text"], "sys");
        assert_eq!(old["contents"][0]["parts"][0]["text"], "usr");
        assert_eq!(old["safetySettings"].as_array().unwrap().len(), 5);

        let new = gemini_body("gemini-3.8-flash", "sys", "usr");
        assert!(new["generationConfig"].get("temperature").is_none());
    }

    #[test]
    fn parse_gemini_joins_text_parts_and_skips_thoughts() {
        let payload = json!({
            "candidates": [{ "content": { "parts": [
                { "text": "thinking...", "thought": true },
                { "text": "{\"title\":" },
                { "text": "\"A\"}" }
            ] } }]
        });
        assert_eq!(parse_gemini(&payload).unwrap(), "{\"title\":\"A\"}");
    }

    #[test]
    fn parse_gemini_reports_block_reason_and_api_error() {
        let blocked = json!({ "promptFeedback": { "blockReason": "PROHIBITED_CONTENT" } });
        assert!(parse_gemini(&blocked).unwrap_err().contains("PROHIBITED_CONTENT"));

        let safety = json!({ "candidates": [{ "finishReason": "SAFETY" }] });
        assert!(parse_gemini(&safety).unwrap_err().contains("SAFETY"));

        let error = json!({ "error": { "message": "API key not valid" } });
        assert!(parse_gemini(&error).unwrap_err().contains("API key not valid"));

        assert_eq!(parse_gemini(&json!({})).unwrap_err(), "Gemini không trả về nội dung");
    }

    #[test]
    fn openai_url_and_body() {
        assert_eq!(openai_url(""), "https://api.openai.com/v1/chat/completions");
        assert_eq!(
            openai_url("http://192.0.2.10/v1/"),
            "http://192.0.2.10/v1/chat/completions"
        );

        let body = openai_body(" gpt-5.6-sol ", "sys", "usr");
        assert_eq!(body["model"], "gpt-5.6-sol");
        assert_eq!(body["response_format"]["type"], "json_object");
        assert_eq!(body["messages"][0]["role"], "system");
        assert_eq!(body["messages"][1]["content"], "usr");
        assert!(body.get("temperature").is_none());
    }

    #[test]
    fn parse_openai_reads_string_and_part_array_content() {
        let plain = json!({ "choices": [{ "message": { "content": "{\"a\":1}" } }] });
        assert_eq!(parse_openai(&plain).unwrap(), "{\"a\":1}");

        let parts = json!({ "choices": [{ "message": { "content": [
            { "type": "text", "text": "{\"a\":" }, { "type": "text", "text": "1}" }
        ] } }] });
        assert_eq!(parse_openai(&parts).unwrap(), "{\"a\":1}");
    }

    #[test]
    fn parse_openai_reports_refusal_filter_and_empty() {
        let refusal = json!({ "choices": [{ "message": { "content": null, "refusal": "No." } }] });
        assert!(parse_openai(&refusal).unwrap_err().contains("No."));

        let filtered = json!({ "choices": [{ "finish_reason": "content_filter", "message": { "content": "" } }] });
        assert!(parse_openai(&filtered).unwrap_err().contains("bộ lọc"));

        assert_eq!(parse_openai(&json!({})).unwrap_err(), "Model không trả về nội dung");
    }

    #[test]
    fn a_reply_cut_off_by_the_output_limit_is_an_error_not_half_a_json() {
        let gemini = json!({ "candidates": [{
            "finishReason": "MAX_TOKENS",
            "content": { "parts": [{ "text": "{\"title\":\"A\",\"description\":\"Đoạn một" }] }
        }] });
        assert_eq!(parse_gemini(&gemini).unwrap_err(), TRUNCATED_REPLY);

        let openai = json!({ "choices": [{
            "finish_reason": "length",
            "message": { "content": "{\"title\":\"A\",\"description\":\"Đoạn một" }
        }] });
        assert_eq!(parse_openai(&openai).unwrap_err(), TRUNCATED_REPLY);

        // A normal stop is still returned as is.
        let done = json!({ "choices": [{ "finish_reason": "stop", "message": { "content": "{}" } }] });
        assert_eq!(parse_openai(&done).unwrap(), "{}");
    }

    #[test]
    fn api_error_message_handles_the_common_shapes() {
        assert_eq!(
            api_error_message(r#"{"error":{"message":"Incorrect API key provided","type":"invalid_request_error"}}"#),
            "Incorrect API key provided"
        );
        assert_eq!(
            api_error_message(r#"[{"error":{"code":400,"message":"API key not valid."}}]"#),
            "API key not valid."
        );
        assert_eq!(api_error_message(r#"{"error":"quota exceeded"}"#), "quota exceeded");
        assert_eq!(api_error_message("<html>502 Bad Gateway</html>"), "");
        assert_eq!(api_error_message("upstream timeout"), "upstream timeout");
    }
}
