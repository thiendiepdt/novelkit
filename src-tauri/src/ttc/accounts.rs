//! The TTC accounts this app is logged into, and which one is active.
//!
//! Pure data + file logic (no network, no Tauri), so it is unit-tested directly; the
//! commands in `session.rs` wrap it. Cookies stay on the Rust side: the frontend only
//! ever sees an `AccountsView`.

use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::fsutil::write_atomic;

pub const ACCOUNTS_FILE: &str = "ttc_accounts.json";
/// Single-account session file of versions up to 1.2.x.
pub const LEGACY_SESSION_FILE: &str = "ttc_session.dat";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtcAccount {
    /// TTC username (`socketUsername` on /account): the stable key. Empty for a session
    /// migrated from the legacy file until its first verification reads it.
    pub username: String,
    pub display_name: String,
    pub cookie: String,
    /// The cookie was rejected the last time it was checked; kept so the user can log in again.
    #[serde(default)]
    pub needs_login: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct AccountsFile {
    pub active: Option<String>,
    pub accounts: Vec<TtcAccount>,
}

/// What the frontend gets about one account.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub username: String,
    pub display_name: String,
    pub needs_login: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsView {
    pub active: Option<String>,
    pub accounts: Vec<AccountInfo>,
}

impl AccountsFile {
    /// Read the accounts file; without one, adopt the cookie of the legacy session file as
    /// the only (active) account, with its username still unknown.
    pub fn load(dir: &Path) -> Self {
        if let Ok(text) = std::fs::read_to_string(dir.join(ACCOUNTS_FILE)) {
            if let Ok(file) = serde_json::from_str::<AccountsFile>(&text) {
                return file;
            }
            log::warn!("{} is unreadable; starting with no account", ACCOUNTS_FILE);
        }
        let legacy = std::fs::read_to_string(dir.join(LEGACY_SESSION_FILE))
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        match legacy {
            Some(cookie) => AccountsFile {
                active: Some(String::new()),
                accounts: vec![TtcAccount {
                    username: String::new(),
                    display_name: String::new(),
                    cookie,
                    needs_login: false,
                }],
            },
            None => AccountsFile::default(),
        }
    }

    /// Write the accounts file; once it exists the legacy file has served its purpose.
    pub fn save(&self, dir: &Path) -> Result<(), String> {
        let json = serde_json::to_vec_pretty(self).map_err(|e| e.to_string())?;
        write_atomic(&dir.join(ACCOUNTS_FILE), &json)
            .map_err(|e| format!("Không lưu được danh sách tài khoản: {}", e))?;
        std::fs::remove_file(dir.join(LEGACY_SESSION_FILE)).ok();
        Ok(())
    }

    pub fn view(&self) -> AccountsView {
        AccountsView {
            active: self.active.clone(),
            accounts: self
                .accounts
                .iter()
                .map(|a| AccountInfo {
                    username: a.username.clone(),
                    display_name: a.display_name.clone(),
                    needs_login: a.needs_login,
                })
                .collect(),
        }
    }

    fn find(&self, username: &str) -> Option<&TtcAccount> {
        self.accounts.iter().find(|a| a.username == username)
    }

    pub fn active_account(&self) -> Option<&TtcAccount> {
        self.active.as_deref().and_then(|u| self.find(u))
    }

    /// Cookie of the named account, or of the active one when `username` is None.
    pub fn cookie_for(&self, username: Option<&str>) -> Result<String, String> {
        match username {
            None => self
                .active_account()
                .map(|a| a.cookie.clone())
                .ok_or_else(|| "Chưa đăng nhập".to_string()),
            Some(name) => self.find(name).map(|a| a.cookie.clone()).ok_or_else(|| {
                format!("Tài khoản {} không còn được đăng nhập trong app", name)
            }),
        }
    }

    /// Add an account, or refresh the cookie and name of the one with the same username.
    /// A legacy entry (empty username) holding the same cookie is the same account.
    pub fn upsert(&mut self, account: TtcAccount) {
        self.accounts
            .retain(|a| !(a.username.is_empty() && a.cookie == account.cookie && !account.username.is_empty()));
        if self.active.as_deref() == Some("") && self.find("").is_none() {
            self.active = Some(account.username.clone());
        }
        match self.accounts.iter_mut().find(|a| a.username == account.username) {
            Some(existing) => *existing = account,
            None => self.accounts.push(account),
        }
    }

    /// Forget an account; when it was active, the first remaining one takes over.
    pub fn remove(&mut self, username: &str) {
        self.accounts.retain(|a| a.username != username);
        if self.active.as_deref() == Some(username) || self.active_account().is_none() {
            self.active = self.accounts.first().map(|a| a.username.clone());
        }
    }

    pub fn set_active(&mut self, username: &str) -> Result<(), String> {
        if self.find(username).is_none() {
            return Err(format!("Không có tài khoản {} trong app", username));
        }
        self.active = Some(username.to_string());
        Ok(())
    }

    pub fn mark_needs_login(&mut self, username: &str, needs_login: bool) {
        if let Some(a) = self.accounts.iter_mut().find(|a| a.username == username) {
            a.needs_login = needs_login;
        }
    }
}

/// A JS string literal value after `name:` in a script (`name: "..."`), decoded.
fn js_string_field(html: &str, name: &str) -> Option<String> {
    let needle = format!("{}:", name);
    let mut from = 0;
    while let Some(pos) = html[from..].find(&needle) {
        let start = from + pos + needle.len();
        let rest = html[start..].trim_start();
        if let Some(body) = rest.strip_prefix('"') {
            // Find the closing quote, skipping escaped characters.
            let mut escaped = false;
            for (i, ch) in body.char_indices() {
                match ch {
                    '\\' if !escaped => escaped = true,
                    '"' if !escaped => {
                        return serde_json::from_str::<String>(&format!("\"{}\"", &body[..i])).ok();
                    }
                    _ => escaped = false,
                }
            }
            return None;
        }
        from = start;
    }
    None
}

/// Username and display name from TTC's /account page (`window.PAGE_DATA`):
/// `socketUsername: "..."` in the header block, `displayName: "..."` in the page block.
/// None when the page is not the account page of a logged-in user.
pub fn parse_account_page(html: &str) -> Option<(String, String)> {
    let username = js_string_field(html, "socketUsername").filter(|u| !u.trim().is_empty())?;
    let display = js_string_field(html, "displayName")
        .filter(|d| !d.trim().is_empty())
        .unwrap_or_else(|| username.clone());
    Some((username, display))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fsutil::test_dir::TempDir;

    fn account(username: &str, cookie: &str) -> TtcAccount {
        TtcAccount {
            username: username.into(),
            display_name: format!("Tên {}", username),
            cookie: cookie.into(),
            needs_login: false,
        }
    }

    #[test]
    fn the_file_round_trips_and_replaces_the_legacy_session() {
        let dir = TempDir::new("accounts-roundtrip");
        std::fs::write(dir.0.join(LEGACY_SESSION_FILE), "old").unwrap();
        let mut file = AccountsFile::default();
        file.upsert(account("a", "c1"));
        file.set_active("a").unwrap();
        file.save(&dir.0).unwrap();

        assert_eq!(AccountsFile::load(&dir.0), file);
        assert!(!dir.0.join(LEGACY_SESSION_FILE).exists());
    }

    #[test]
    fn a_legacy_session_becomes_the_active_account() {
        let dir = TempDir::new("accounts-legacy");
        std::fs::write(dir.0.join(LEGACY_SESSION_FILE), " s%3Aabc \n").unwrap();
        let file = AccountsFile::load(&dir.0);
        assert_eq!(file.active.as_deref(), Some(""));
        assert_eq!(file.cookie_for(None).unwrap(), "s%3Aabc");

        assert_eq!(AccountsFile::load(&TempDir::new("accounts-empty").0), AccountsFile::default());
    }

    #[test]
    fn identifying_the_legacy_session_replaces_its_entry() {
        let dir = TempDir::new("accounts-identify");
        std::fs::write(dir.0.join(LEGACY_SESSION_FILE), "c1").unwrap();
        let mut file = AccountsFile::load(&dir.0);
        file.upsert(account("thiendiepdt", "c1"));

        assert_eq!(file.accounts.len(), 1);
        assert_eq!(file.active.as_deref(), Some("thiendiepdt"));
        assert_eq!(file.cookie_for(Some("thiendiepdt")).unwrap(), "c1");
    }

    #[test]
    fn upsert_refreshes_an_account_in_place() {
        let mut file = AccountsFile::default();
        file.upsert(account("a", "c1"));
        file.upsert(account("b", "c2"));
        file.mark_needs_login("a", true);
        file.upsert(account("a", "c3"));

        assert_eq!(file.accounts.iter().map(|a| a.username.as_str()).collect::<Vec<_>>(), ["a", "b"]);
        assert_eq!(file.cookie_for(Some("a")).unwrap(), "c3");
        assert!(!file.accounts[0].needs_login);
    }

    #[test]
    fn removing_the_active_account_hands_over_to_the_next() {
        let mut file = AccountsFile::default();
        file.upsert(account("a", "c1"));
        file.upsert(account("b", "c2"));
        file.set_active("a").unwrap();

        file.remove("a");
        assert_eq!(file.active.as_deref(), Some("b"));
        file.remove("b");
        assert_eq!(file.active, None);
        assert_eq!(file.cookie_for(None).unwrap_err(), "Chưa đăng nhập");
    }

    #[test]
    fn removing_another_account_keeps_the_active_one() {
        let mut file = AccountsFile::default();
        file.upsert(account("a", "c1"));
        file.upsert(account("b", "c2"));
        file.set_active("b").unwrap();
        file.remove("a");
        assert_eq!(file.active.as_deref(), Some("b"));
    }

    #[test]
    fn a_pinned_job_names_the_account_that_is_gone() {
        let mut file = AccountsFile::default();
        file.upsert(account("a", "c1"));
        file.set_active("a").unwrap();
        assert_eq!(file.cookie_for(Some("a")).unwrap(), "c1");
        let err = file.cookie_for(Some("ghost")).unwrap_err();
        assert!(err.contains("ghost"), "{}", err);
        assert!(file.set_active("ghost").is_err());
    }

    #[test]
    fn the_view_carries_no_cookie() {
        let mut file = AccountsFile::default();
        file.upsert(account("a", "secret-cookie"));
        file.set_active("a").unwrap();
        let json = serde_json::to_string(&file.view()).unwrap();
        assert!(!json.contains("secret-cookie"), "{}", json);
        assert!(json.contains("\"displayName\":\"Tên a\""), "{}", json);
        assert!(json.contains("\"needsLogin\":false"), "{}", json);
    }

    #[test]
    fn the_account_page_gives_username_and_display_name() {
        // The two PAGE_DATA blocks of the real page, trimmed.
        let html = r#"<script>
window.PAGE_DATA = Object.assign(window.PAGE_DATA || {}, {
    socketUsername: "thiendiepdt",
    successMsg: null,
});
</script>
<script>
window.PAGE_DATA = Object.assign(window.PAGE_DATA || {}, {
    renameNeedPay: false,
    displayName: "Thương Hải \"Hoành\" Lưu"
});
</script>"#;
        assert_eq!(
            parse_account_page(html),
            Some(("thiendiepdt".into(), "Thương Hải \"Hoành\" Lưu".into()))
        );
    }

    #[test]
    fn the_account_page_without_a_user_is_rejected() {
        assert_eq!(parse_account_page("<html>login form</html>"), None);
        assert_eq!(parse_account_page("socketUsername: \"\","), None);
        // No display name: the username stands in.
        assert_eq!(
            parse_account_page("socketUsername: \"bob\","),
            Some(("bob".into(), "bob".into()))
        );
    }
}
