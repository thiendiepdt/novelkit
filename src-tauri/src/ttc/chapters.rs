use regex::Regex;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter, Listener};
use tokio::fs::OpenOptions;
use tokio::io::AsyncWriteExt;
use tokio::time::sleep;

use super::client::{get_client, get_session, get_ttc_base, USER_AGENT};
use super::types::*;
use super::utils::sanitize_filename;

// ─── Fetch Chapters Command ───────────────────────────────

#[tauri::command]
pub async fn ttc_fetch_chapters(
    app: AppHandle,
    book_id: i64,
    page: Option<i64>,
    limit: Option<i64>,
) -> Result<TtcChaptersResponse, String> {
    let session = get_session(&app)?;

    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(50);
    let base_url = get_ttc_base(&app).await?;
    let url = format!(
        "{}/api/get-chapters/{}?page={}&limit={}",
        base_url, book_id, page, limit
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

    let text = resp
        .text()
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    let body: TtcChaptersResponse = serde_json::from_str(&text).map_err(|e| {
        let preview = &text[..text.len().min(500)];
        log::error!("Chapter API parse error: {}. Raw: {}", e, preview);
        format!("Parse error: {}. Response: {}", e, preview)
    })?;

    Ok(body)
}

// ─── Read Folder Text Command (For Splitter) ────────────────

#[tauri::command]
pub async fn ttc_read_folder_text(folder_path: String) -> Result<String, String> {
    let dir = std::fs::read_dir(&folder_path).map_err(|e| format!("Cannot read folder: {}", e))?;

    let mut files: Vec<String> = dir
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".txt") {
                Some(name)
            } else {
                None
            }
        })
        .collect();

    // Natural sort: extract first number and sort by it
    let num_re = Regex::new(r"\d+").unwrap();
    files.sort_by(|a, b| {
        let num_a = num_re
            .captures(a)
            .and_then(|c| c[0].parse::<i64>().ok())
            .unwrap_or(i64::MAX);
        let num_b = num_re
            .captures(b)
            .and_then(|c| c[0].parse::<i64>().ok())
            .unwrap_or(i64::MAX);
        if num_a != num_b {
            num_a.cmp(&num_b)
        } else {
            a.cmp(b)
        }
    });

    let mut all_text = String::new();
    for file_name in &files {
        let file_path = std::path::Path::new(&folder_path).join(file_name);
        if let Ok(text) = std::fs::read_to_string(&file_path) {
            all_text.push_str(&text);
            all_text.push_str("\n\n");
        }
    }

    Ok(all_text)
}

// ─── CSRF & Upload Nonce Helper ────────────────────────────

async fn ttc_fetch_upload_tokens(
    client: &reqwest::Client,
    base_url: &str,
    session: &str,
    book_id: i64,
) -> Result<(String, String), String> {
    let url = format!("{}/dang-chuong/{}", base_url, book_id);
    let resp = client
        .get(&url)
        .header("Cookie", format!("session={}", session))
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối khi lấy Token: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Lỗi HTTP {} khi lấy Token", resp.status()));
    }

    let html = resp
        .text()
        .await
        .map_err(|e| format!("Lỗi đọc HTML: {}", e))?;

    let csrf_token = Regex::new(r#"name="?_csrf"?\s+value="([^"]+)""#)
        .unwrap()
        .captures(&html)
        .map(|caps| caps[1].to_string())
        .ok_or_else(|| "Không tìm thấy _csrf token trên trang đăng chương".to_string())?;

    let upload_nonce = Regex::new(r#"name="?_upload_nonce"?\s+value="([^"]+)""#)
        .unwrap()
        .captures(&html)
        .map(|caps| caps[1].to_string())
        .ok_or_else(|| "Không tìm thấy _upload_nonce trên trang đăng chương".to_string())?;

    Ok((csrf_token, upload_nonce))
}

// ─── Upload Chapters Command ──────────────────────────────

#[tauri::command]
pub async fn ttc_upload_chapters(
    app: AppHandle,
    options: UploadOptions,
    job_id: String,
) -> Result<(), String> {
    let session = get_session(&app)?;

    let chapters: Vec<&ParsedChapter> = options.chapters.iter().collect();

    let total = chapters.len();
    let delay = options.delay_ms.unwrap_or(1000);
    let price = options.price.unwrap_or(0);
    let unlock_timer = options.unlock_timer.clone().unwrap_or_default();
    let client = get_client(&app);
    let base_url = get_ttc_base(&app).await?;

    // Fetch Tokens
    let (csrf_token, upload_nonce) =
        match ttc_fetch_upload_tokens(&client, &base_url, &session, options.book_id).await {
            Ok(tokens) => tokens,
            Err(e) => return Err(e),
        };

    // Cancellation support
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let cancel_flag_clone = Arc::clone(&cancel_flag);
    let cancel_event_name = format!("ttc://cancel-upload-{}", job_id);

    let _cancel_listener = app.listen(cancel_event_name, move |_| {
        cancel_flag_clone.store(true, Ordering::SeqCst);
    });

    let mut success_count = 0usize;
    let mut fail_count = 0usize;
    let mut current_nonce = upload_nonce;

    for (chunk_idx, chunk) in chapters.chunks(100).enumerate() {
        if cancel_flag.load(Ordering::SeqCst) {
            log::info!("Upload job {} cancelled by user", job_id);
            return Err("Bị hủy bởi người dùng".to_string());
        }

        let chunk_size = chunk.len();
        // Emit progress
        app.emit(
            "ttc://upload-progress",
            UploadProgressEvent {
                job_id: Some(job_id.clone()),
                current: success_count + fail_count,
                total,
                current_title: format!("Đang up batch {} ({} chương)", chunk_idx + 1, chunk_size),
                success: success_count,
                failed: fail_count,
                status: "uploading".into(),
                message: None,
            },
        )
        .ok();

        let mut payload_chapters = Vec::new();
        for chapter in chunk {
            payload_chapters.push(UploadChapterItem {
                index: chapter.index,
                title: chapter.title.clone(),
                content: chapter.content.clone(),
                word_count: chapter.word_count,
                price: chapter.price.unwrap_or(price),
                link: String::new(),
            });
        }

        let payload = UploadChapterPayload {
            chapters: payload_chapters,
            upload_type: "normal".into(),
            scheduled_at: String::new(),
            unlock_timer: unlock_timer.clone(),
            serial_mode: false,
            serial_first_at: String::new(),
            serial_chunks_per_day: 5,
        };

        let url = format!("{}/luu-cac-chuong/{}", base_url, options.book_id);

        let mut attempts = 0;
        'retry_loop: while attempts < 3 {
            attempts += 1;

            match client
                .post(&url)
                .header("Cookie", format!("session={}", session))
                .header("User-Agent", USER_AGENT)
                .header("Origin", &base_url)
                .header(
                    "Referer",
                    format!("{}/dang-chuong/{}", base_url, options.book_id),
                )
                .header("x-csrf-token", &csrf_token)
                .header("x-upload-nonce", &current_nonce)
                .json(&payload)
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => {
                    let body_text = resp.text().await.unwrap_or_default();
                    if let Ok(json_resp) = serde_json::from_str::<UploadChapterResponse>(&body_text)
                    {
                        if json_resp.success {
                            success_count += chunk_size;
                            if let Some(new_nonce) = json_resp.new_nonce {
                                current_nonce = new_nonce;
                            }
                            break 'retry_loop;
                        } else {
                            if let Some(msg) = &json_resp.message {
                                if let Some(caps) =
                                    Regex::new(r"chờ\s+(\d+)s").unwrap().captures(msg)
                                {
                                    let wait_secs: u64 = caps[1].parse().unwrap_or(60);
                                    log::warn!("Bị giới hạn tốc độ. Chờ {}s...", wait_secs);

                                    app.emit(
                                        "ttc://upload-progress",
                                        UploadProgressEvent {
                                            job_id: Some(job_id.clone()),
                                            current: success_count + fail_count,
                                            total,
                                            current_title: format!(
                                                "Tạm dừng chờ {}s...",
                                                wait_secs
                                            ),
                                            success: success_count,
                                            failed: fail_count,
                                            status: "uploading".into(),
                                            message: Some(msg.clone()),
                                        },
                                    )
                                    .ok();

                                    for _ in 0..wait_secs + 2 {
                                        if cancel_flag.load(Ordering::SeqCst) {
                                            return Err("Bị hủy bởi người dùng".to_string());
                                        }
                                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                                    }
                                    continue 'retry_loop;
                                }
                            }
                            fail_count += chunk_size;
                            log::warn!("Upload failed for batch {}: {}", chunk_idx + 1, body_text);
                            break 'retry_loop;
                        }
                    } else {
                        success_count += chunk_size; // Fallback
                        break 'retry_loop;
                    }
                }
                Ok(resp) => {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_default();

                    if status == 429 || body.contains("quá nhanh") {
                        if let Some(caps) = Regex::new(r"chờ\s+(\d+)s").unwrap().captures(&body) {
                            let wait_secs: u64 = caps[1].parse().unwrap_or(60);
                            log::warn!("HTTP 429. Chờ {}s...", wait_secs);

                            app.emit(
                                "ttc://upload-progress",
                                UploadProgressEvent {
                                    job_id: Some(job_id.clone()),
                                    current: success_count + fail_count,
                                    total,
                                    current_title: format!(
                                        "HTTP 429 - Tạm dừng chờ {}s...",
                                        wait_secs
                                    ),
                                    success: success_count,
                                    failed: fail_count,
                                    status: "uploading".into(),
                                    message: Some("Đang đăng chương quá nhanh".into()),
                                },
                            )
                            .ok();

                            for _ in 0..wait_secs + 2 {
                                if cancel_flag.load(Ordering::SeqCst) {
                                    return Err("Bị hủy bởi người dùng".to_string());
                                }
                                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            }
                            continue 'retry_loop;
                        }
                    }

                    fail_count += chunk_size;
                    log::warn!(
                        "Upload failed for batch {}: HTTP {} - {}",
                        chunk_idx + 1,
                        status,
                        body
                    );
                    break 'retry_loop;
                }
                Err(e) => {
                    fail_count += chunk_size;
                    log::error!("Upload error for batch {}: {}", chunk_idx + 1, e);
                    break 'retry_loop;
                }
            }
        }

        // Delay between chunks (except last)
        if chunk_idx < chapters.len() / 100 {
            for _ in 0..(delay / 100).max(1) {
                if cancel_flag.load(Ordering::SeqCst) {
                    return Err("Bị hủy bởi người dùng".to_string());
                }
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
        }
    }

    // Emit final progress
    app.emit(
        "ttc://upload-progress",
        UploadProgressEvent {
            job_id: Some(job_id.clone()),
            current: total,
            total,
            current_title: String::new(),
            success: success_count,
            failed: fail_count,
            status: "done".into(),
            message: Some(format!(
                "Hoàn tất: {} thành công, {} thất bại",
                success_count, fail_count
            )),
        },
    )
    .ok();

    Ok(())
}

// ─── Download Chapter Command ─────────────────────────────

#[tauri::command]
pub async fn ttc_download_chapter(
    app: AppHandle,
    book_id: i64,
    chapter_number: i64,
) -> Result<DownloadedChapter, String> {
    let session = get_session(&app)?;

    let base_url = get_ttc_base(&app).await?;
    let url = format!("{}/sua-chuong/{}/{}", base_url, book_id, chapter_number);

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

    let html = resp
        .text()
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    // Parse the HTML document
    let document = scraper::Html::parse_document(&html);

    // Extract title from: <input ... name="title" ... value="...">
    let title_selector = scraper::Selector::parse("input[name='title']").unwrap();
    let title = document
        .select(&title_selector)
        .next()
        .and_then(|el| el.value().attr("value"))
        .map(|s| s.to_string())
        .ok_or("Không tìm thấy tiêu đề chương trong trang sửa chương")?;

    // Extract content from: <textarea ... name="content" ...>...</textarea>
    let content_selector = scraper::Selector::parse("textarea[name='content']").unwrap();
    let mut content = document
        .select(&content_selector)
        .next()
        .map(|el| el.text().collect::<String>())
        .ok_or("Không tìm thấy nội dung chương trong trang sửa chương")?;

    // Normalize HTML line breaks
    content = content
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("</p><p>", "\n\n")
        .replace("<p>", "")
        .replace("</p>", "\n");

    Ok(DownloadedChapter { title, content })
}

// ─── Download All Chapters Command ────────────────────────

#[tauri::command]
pub async fn ttc_download_all_chapters(
    app: AppHandle,
    options: DownloadAllOptions,
    job_id: String,
) -> Result<(), String> {
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let cancel_flag_clone = cancel_flag.clone();

    let event_name = format!("ttc://cancel-download-{}", job_id);
    let event_id = app.listen(event_name.clone(), move |_| {
        cancel_flag_clone.store(true, Ordering::SeqCst);
    });

    let app_clone = app.clone();
    let emit = move |event: DownloadAllProgressEvent| {
        let _ = app_clone.emit("ttc://download-all-progress", event);
    };

    emit(DownloadAllProgressEvent {
        current: 0,
        total: 0,
        current_title: "Đang lấy danh sách chương...".to_string(),
        success: 0,
        failed: 0,
        status: "fetching_list".to_string(),
        message: None,
    });

    // 1. Fetch all chapters
    let mut all_chapters = Vec::new();
    let mut current_page = 1;
    let mut total_pages = 1;

    while current_page <= total_pages {
        if cancel_flag.load(Ordering::SeqCst) {
            app.unlisten(event_id);
            return Err("Bị hủy bởi người dùng".into());
        }

        match ttc_fetch_chapters(app.clone(), options.book_id, Some(current_page), Some(100)).await
        {
            Ok(resp) => {
                total_pages = resp.total_pages;
                all_chapters.extend(resp.chapters);
                current_page += 1;
            }
            Err(e) => {
                return Err(format!(
                    "Lỗi khi lấy danh sách chương trang {}: {}",
                    current_page, e
                ));
            }
        }
    }

    let total = all_chapters.len();
    if total == 0 {
        return Err("Không tìm thấy chương nào để tải.".to_string());
    }

    all_chapters.sort_by_key(|chapter| chapter.chapter_number);

    let mut success_count = 0;
    let mut failed_count = 0;
    let delay = std::time::Duration::from_millis(options.delay_ms.unwrap_or(100));
    let chunk_size = options.chunk_size.unwrap_or(100) as usize;

    let thread_count = options.threads.unwrap_or(1).max(1).min(5) as usize;
    let indexed_chapters: Vec<(usize, &TtcChapter)> = all_chapters.iter().enumerate().collect();

    for chunk in indexed_chapters.chunks(thread_count) {
        if cancel_flag.load(Ordering::SeqCst) {
            app.unlisten(event_id);
            return Err("Bị hủy bởi người dùng".into());
        }

        let mut futures = Vec::new();

        for (i, ch) in chunk {
            emit(DownloadAllProgressEvent {
                current: *i,
                total,
                current_title: ch.title.clone(),
                success: success_count,
                failed: failed_count,
                status: "downloading".to_string(),
                message: None,
            });

            let app_clone = app.clone();
            let book_id = options.book_id;
            let chapter_number = ch.chapter_number;

            futures.push(async move {
                let res = ttc_download_chapter(app_clone, book_id, chapter_number).await;
                (*i, (*ch).clone(), res)
            });
        }

        let results = futures::future::join_all(futures).await;

        for (i, ch, result) in results {
            match result {
                Ok(downloaded) => {
                    let content_to_write =
                        format!("{}\n\n{}\n\n", downloaded.title, downloaded.content);

                    let file_path = match options.mode.as_str() {
                        "single" => PathBuf::from(&options.save_dir),
                        "split" => {
                            let name = format!(
                                "Chương {:04} - {}.txt",
                                ch.chapter_number,
                                sanitize_filename(&ch.title)
                            );
                            Path::new(&options.save_dir).join(name)
                        }
                        "chunked" => {
                            let chunk_index = i / chunk_size;
                            let start_chap = chunk_index * chunk_size + 1;
                            let end_chap = std::cmp::min((chunk_index + 1) * chunk_size, total);
                            let name = format!(
                                "{} ({} - {}).txt",
                                sanitize_filename(&options.book_title),
                                start_chap,
                                end_chap
                            );
                            Path::new(&options.save_dir).join(name)
                        }
                        _ => return Err(format!("Chế độ tải không hợp lệ: {}", options.mode)),
                    };

                    let mut file_opts = OpenOptions::new();
                    file_opts.create(true).append(true);
                    if options.mode == "split" {
                        file_opts.write(true).truncate(true).append(false);
                    }

                    match file_opts.open(&file_path).await {
                        Ok(mut f) => {
                            if let Err(e) = f.write_all(content_to_write.as_bytes()).await {
                                failed_count += 1;
                                log::error!("Write error: {}", e);
                            } else {
                                success_count += 1;
                            }
                        }
                        Err(e) => {
                            failed_count += 1;
                            log::error!("File open error: {}", e);
                        }
                    }
                }
                Err(e) => {
                    failed_count += 1;
                    log::error!("Download chapter {} error: {}", ch.chapter_number, e);
                }
            }
        }

        sleep(delay).await;
    }

    emit(DownloadAllProgressEvent {
        current: total,
        total,
        current_title: "".to_string(),
        success: success_count,
        failed: failed_count,
        status: "done".to_string(),
        message: Some(format!(
            "Hoàn tất: {} thành công, {} thất bại",
            success_count, failed_count
        )),
    });

    app.unlisten(event_id);
    Ok(())
}
