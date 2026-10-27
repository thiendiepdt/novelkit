//! Key-value store for what the frontend used to keep in the webview's localStorage
//! (settings, AI keys). On desktop it lives in `user_data.json` in the app data dir, so it
//! survives a reset of the WebView2 profile and is part of the user's data.
//!
//! Values are opaque strings, exactly as localStorage holds them; the frontend
//! (`shared/utils/persistentStore.ts`) keeps a synchronous in-memory copy and sends every
//! change here.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::fsutil::write_atomic;

const FILE_NAME: &str = "user_data.json";
const VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
struct StoreFile {
    version: u32,
    items: HashMap<String, String>,
}

/// Managed state. `items` is None until the file exists (first run: nothing imported yet).
pub struct UserStore {
    path: PathBuf,
    items: Mutex<Option<HashMap<String, String>>>,
}

impl UserStore {
    pub fn load(app_data_dir: &Path) -> Self {
        let path = app_data_dir.join(FILE_NAME);
        let items = match std::fs::read_to_string(&path) {
            Ok(text) => match serde_json::from_str::<StoreFile>(&text) {
                Ok(file) => Some(file.items),
                Err(e) => {
                    // Keep the unreadable file for inspection instead of overwriting it later.
                    log::warn!("{} is unreadable ({}); starting over", FILE_NAME, e);
                    std::fs::rename(&path, path.with_extension("json.corrupt")).ok();
                    None
                }
            },
            Err(_) => None,
        };
        Self {
            path,
            items: Mutex::new(items),
        }
    }

    fn persist(&self, items: &HashMap<String, String>) -> Result<(), String> {
        let file = StoreFile {
            version: VERSION,
            items: items.clone(),
        };
        let json = serde_json::to_vec_pretty(&file).map_err(|e| e.to_string())?;
        write_atomic(&self.path, &json).map_err(|e| format!("Không ghi được {}: {}", FILE_NAME, e))
    }

    /// Everything stored, or None before the first import.
    pub fn snapshot(&self) -> Option<HashMap<String, String>> {
        self.items.lock().unwrap().clone()
    }

    /// First-run migration: create the file from the webview's localStorage. Returns false
    /// (and changes nothing) when the store already exists, so a second window or a retry
    /// can never replace newer data with the old localStorage.
    pub fn import(&self, items: HashMap<String, String>) -> Result<bool, String> {
        let mut guard = self.items.lock().unwrap();
        if guard.is_some() {
            return Ok(false);
        }
        self.persist(&items)?;
        *guard = Some(items);
        Ok(true)
    }

    pub fn set(&self, key: String, value: String) -> Result<(), String> {
        let mut guard = self.items.lock().unwrap();
        let mut items = guard.clone().unwrap_or_default();
        items.insert(key, value);
        self.persist(&items)?;
        *guard = Some(items);
        Ok(())
    }

    pub fn remove(&self, key: &str) -> Result<(), String> {
        let mut guard = self.items.lock().unwrap();
        let mut items = guard.clone().unwrap_or_default();
        items.remove(key);
        self.persist(&items)?;
        *guard = Some(items);
        Ok(())
    }
}

// ─── Commands ──────────────────────────────────────────────

#[tauri::command]
pub fn user_store_load(app: AppHandle) -> Option<HashMap<String, String>> {
    app.state::<UserStore>().snapshot()
}

#[tauri::command]
pub fn user_store_import(app: AppHandle, items: HashMap<String, String>) -> Result<bool, String> {
    app.state::<UserStore>().import(items)
}

#[tauri::command]
pub fn user_store_set(app: AppHandle, key: String, value: String) -> Result<(), String> {
    app.state::<UserStore>().set(key, value)
}

#[tauri::command]
pub fn user_store_remove(app: AppHandle, key: String) -> Result<(), String> {
    app.state::<UserStore>().remove(&key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fsutil::test_dir::TempDir;

    fn items(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn a_missing_file_loads_as_not_yet_imported() {
        let dir = TempDir::new("store-missing");
        assert_eq!(UserStore::load(&dir.0).snapshot(), None);
    }

    #[test]
    fn import_happens_once() {
        let dir = TempDir::new("store-import");
        let store = UserStore::load(&dir.0);
        assert!(store.import(items(&[("nk_global_settings", "{\"a\":1}")])).unwrap());
        assert!(!store.import(items(&[("nk_global_settings", "old")])).unwrap());
        assert_eq!(store.snapshot().unwrap()["nk_global_settings"], "{\"a\":1}");

        // Also after a restart.
        let reloaded = UserStore::load(&dir.0);
        assert!(!reloaded.import(items(&[("x", "y")])).unwrap());
        assert_eq!(reloaded.snapshot().unwrap(), items(&[("nk_global_settings", "{\"a\":1}")]));
    }

    #[test]
    fn set_and_remove_persist_across_a_restart() {
        let dir = TempDir::new("store-set");
        let store = UserStore::load(&dir.0);
        store.set("k1".into(), "v1".into()).unwrap();
        store.set("k2".into(), "v2".into()).unwrap();
        store.remove("k1").unwrap();
        assert_eq!(UserStore::load(&dir.0).snapshot().unwrap(), items(&[("k2", "v2")]));
    }

    #[test]
    fn a_corrupt_file_is_set_aside_not_overwritten_in_place() {
        let dir = TempDir::new("store-corrupt");
        std::fs::write(dir.0.join(FILE_NAME), "{not json").unwrap();
        let store = UserStore::load(&dir.0);
        assert_eq!(store.snapshot(), None);
        assert_eq!(
            std::fs::read_to_string(dir.0.join("user_data.json.corrupt")).unwrap(),
            "{not json"
        );
        assert!(store.import(items(&[("a", "b")])).unwrap());
    }
}
