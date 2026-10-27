// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod ai;
mod fsutil;
mod net;
mod novel_source;
mod ttc;
mod user_store;

use tauri::Manager;
use ttc::client::TtcClient;
use ttc::image::TtcImageCache;
use ttc::session::TtcSession;
use user_store::UserStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(TtcClient::default())
        .manage(TtcImageCache::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // Session & auth
            ttc::session::ttc_open_login,
            ttc::session::ttc_check_session,
            ttc::session::ttc_list_accounts,
            ttc::session::ttc_verify_active,
            ttc::session::ttc_switch_account,
            ttc::session::ttc_logout,
            // Books & editing
            ttc::books::ttc_fetch_books,
            ttc::books::ttc_fetch_html,
            ttc::books::ttc_submit_multipart,
            ttc::books::ttc_create_story,
            ttc::books::ttc_delete_story,
            ttc::books::ttc_upload_cover,
            // Chapters
            ttc::chapters::ttc_fetch_chapters,
            ttc::chapters::ttc_read_folder_files,
            ttc::chapters::ttc_upload_chapters,
            ttc::chapters::ttc_download_chapter,
            ttc::chapters::ttc_download_all_chapters,
            // Image proxy
            ttc::image::ttc_proxy_image,
            ttc::image::ttc_read_local_file,
            // Utils
            ttc::utils::ttc_open_folder,
            // Source novel sites (Fanqie / QQ / Qidian) for AI fill
            novel_source::source_fetch_text,
            novel_source::source_fetch_image,
            // AI (Gemini / OpenAI-compatible)
            ai::ai_generate_json,
            // Settings store (replaces the webview localStorage on desktop)
            user_store::user_store_load,
            user_store::user_store_import,
            user_store::user_store_set,
            user_store::user_store_remove,
        ])
        .setup(|app| {
            // Load the TTC accounts (and the settings store) from the app data dir
            let app_data_dir = app.path().app_data_dir()?;
            app.manage(TtcSession::load(&app_data_dir));
            app.manage(UserStore::load(&app_data_dir));

            // Updater is desktop-only (mobile uses app stores)
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
