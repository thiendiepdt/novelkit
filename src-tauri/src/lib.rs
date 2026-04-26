// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod ttc;

use tauri::Manager;
use ttc::client::TtcClient;
use ttc::image::TtcImageCache;
use ttc::session::TtcSession;

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
            ttc::session::ttc_get_session,
            ttc::session::ttc_logout,
            ttc::session::ttc_verify_session,
            // Books & editing
            ttc::books::ttc_fetch_books,
            ttc::books::ttc_fetch_html,
            ttc::books::ttc_submit_multipart,
            ttc::books::ttc_upload_cover,
            // Chapters
            ttc::chapters::ttc_fetch_chapters,
            ttc::chapters::ttc_read_folder_text,
            ttc::chapters::ttc_upload_chapters,
            ttc::chapters::ttc_download_chapter,
            ttc::chapters::ttc_download_all_chapters,
            // Image proxy
            ttc::image::ttc_proxy_image,
            ttc::image::ttc_read_local_file,
            // Utils
            ttc::utils::ttc_open_folder,
        ])
        .setup(|app| {
            // Load persisted TTC session from app data dir
            let app_data_dir = app.path().app_data_dir()?;
            app.manage(TtcSession::load(&app_data_dir));

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
