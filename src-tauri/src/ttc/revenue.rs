//! Revenue ("Doanh thu"): the purchase notifications of TTC (the "Tài chính" tab of
//! /thong-bao) and the ledger built from them.
//!
//! TTC keeps only the last ~5000 notifications of an account (about a week), so the
//! frontend (`ttc-uploader/revenue/`) folds them into daily totals and keeps those here:
//! `revenue/<username>/<YYYY-MM>.json` (the days of a month) and `revenue/<username>/sync.json`
//! (which spans of time are already counted). Parsing and counting happen in the frontend;
//! this module only fetches pages and stores opaque JSON.

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use super::client::{get_client, get_session_for, get_ttc_base, USER_AGENT};
use crate::fsutil::write_atomic;

const DIR_NAME: &str = "revenue";

/// One page (50 notifications, newest first) of the purchase notifications of `account`.
/// The account is explicit: a sync that started before an account switch keeps reading
/// the account it started with.
#[tauri::command]
pub async fn ttc_fetch_purchases(app: AppHandle, account: String, page: u32) -> Result<String, String> {
    let session = get_session_for(&app, Some(&account))?;
    let base_url = get_ttc_base(&app).await?;
    let url = format!("{}/thong-bao?page={}&type=purchase", base_url, page.max(1));

    let resp = get_client(&app)
        .get(&url)
        .header("Cookie", format!("session={}", session))
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Không tải được thông báo TTC: {}", e))?;

    // A refused cookie is redirected to the login page (followed by reqwest).
    if resp.url().path().starts_with("/login") {
        return Err(format!("Phiên đăng nhập TTC của {} đã hết hạn", account));
    }
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.text()
        .await
        .map_err(|e| format!("Không đọc được trang thông báo TTC: {}", e))
}

/// A TTC username used as a directory name: plain characters only, never a path.
fn valid_account(account: &str) -> bool {
    !account.is_empty()
        && account.len() <= 64
        && account != "."
        && account != ".."
        && account
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
}

/// `sync` or a month (`YYYY-MM`).
fn valid_file(file: &str) -> bool {
    if file == "sync" {
        return true;
    }
    let b = file.as_bytes();
    b.len() == 7 && b[4] == b'-' && b.iter().enumerate().all(|(i, c)| i == 4 || c.is_ascii_digit())
}

fn ledger_path(app: &AppHandle, account: &str, file: &str) -> Result<PathBuf, String> {
    if !valid_account(account) {
        return Err(format!("Tên tài khoản không hợp lệ: {}", account));
    }
    if !valid_file(file) {
        return Err(format!("Tên file doanh thu không hợp lệ: {}", file));
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(DIR_NAME).join(account).join(format!("{}.json", file)))
}

/// Contents of a ledger file, or None when it does not exist yet.
#[tauri::command]
pub fn revenue_read(app: AppHandle, account: String, file: String) -> Result<Option<String>, String> {
    let path = ledger_path(&app, &account, &file)?;
    match std::fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Không đọc được {}: {}", path.display(), e)),
    }
}

#[tauri::command]
pub fn revenue_write(app: AppHandle, account: String, file: String, contents: String) -> Result<(), String> {
    let path = ledger_path(&app, &account, &file)?;
    write_atomic(&path, contents.as_bytes()).map_err(|e| format!("Không ghi được {}: {}", path.display(), e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accounts_are_plain_names() {
        assert!(valid_account("thiendiepdt"));
        assert!(valid_account("user.name_01-x"));
        for bad in ["", ".", "..", "a/b", "a\\b", "../x", "a b", "tên"] {
            assert!(!valid_account(bad), "{:?}", bad);
        }
    }

    #[test]
    fn files_are_sync_or_a_month() {
        assert!(valid_file("sync"));
        assert!(valid_file("2026-11"));
        for bad in ["", "2026-1", "2026_11", "2026-11.json", "../sync", "abcd-ef"] {
            assert!(!valid_file(bad), "{:?}", bad);
        }
    }
}
