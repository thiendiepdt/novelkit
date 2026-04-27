use serde::{Deserialize, Serialize};

// ─── TTC API Response Types ────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TtcStory {
    pub id: i64,
    pub title: String,
    pub author: String,
    pub poster: String,
    pub category: String,
    pub status: String,
    pub total_chapters: i64,
    pub latest_chapter_title: Option<String>,
    pub last_chap_updated: Option<String>,
    pub views: i64,
    pub follows: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TtcBooksResponse {
    pub success: bool,
    pub stories: Vec<TtcStory>,
    #[serde(rename = "totalPages")]
    pub total_pages: i64,
    #[serde(rename = "totalStories")]
    pub total_stories: i64,
    #[serde(rename = "currentPage")]
    pub current_page: i64,
}

// ─── TTC Chapter List Types (from API) ─────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TtcChapter {
    #[serde(rename = "chapterNumber")]
    pub chapter_number: i64,
    pub title: String,
    #[serde(default, rename = "wordCount")]
    pub word_count: i64,
    #[serde(default)]
    pub views: i64,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default, rename = "chapter_price")]
    pub chapter_price: i64,
    #[serde(default)]
    pub last_chap_updated: Option<String>,
    #[serde(default)]
    pub edited_at: Option<String>,
    #[serde(default)]
    pub published_at: Option<String>,
    #[serde(default)]
    pub unlock_link: Option<String>,
    #[serde(default)]
    pub buy_count: i64,
    #[serde(default)]
    pub link_click_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TtcChaptersResponse {
    pub success: bool,
    pub chapters: Vec<TtcChapter>,
    #[serde(default, rename = "totalPages")]
    pub total_pages: i64,
    #[serde(default, rename = "totalChapters")]
    pub total_chapters: i64,
    #[serde(default, rename = "currentPage")]
    pub current_page: i64,
}

// ─── Chapter Parsing Types ─────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParsedChapter {
    pub index: usize,
    pub title: String,
    pub content: String,
    pub word_count: usize,
    pub file_name: String,
    pub price: Option<i32>,
}

// ─── Upload Types ──────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct UploadProgressEvent {
    pub job_id: Option<String>,
    pub current: usize,
    pub total: usize,
    pub current_title: String,
    pub success: usize,
    pub failed: usize,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UploadOptions {
    pub book_id: i64,
    pub chapters: Vec<ParsedChapter>,
    pub delay_ms: Option<u64>,
    pub price: Option<i32>,
    pub unlock_timer: Option<String>,
}

// ─── Upload API Payload (matches TTC API) ──────────────────

#[derive(Debug, Serialize)]
pub struct UploadChapterPayload {
    pub chapters: Vec<UploadChapterItem>,
    #[serde(rename = "type")]
    pub upload_type: String,
    pub scheduled_at: String,
    pub unlock_timer: String,
    pub serial_mode: bool,
    pub serial_first_at: String,
    pub serial_chunks_per_day: i32,
}

#[derive(Debug, Deserialize)]
pub struct UploadChapterResponse {
    pub success: bool,
    pub message: Option<String>,
    #[serde(rename = "newNonce")]
    pub new_nonce: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UploadChapterItem {
    pub index: usize,
    pub title: String,
    pub content: String,
    #[serde(rename = "wordCount")]
    pub word_count: usize,
    pub price: i32,
    pub link: String,
}

// ─── Download Chapter (scraped from edit page) ─────────────

#[derive(Debug, Serialize)]
pub struct DownloadedChapter {
    pub title: String,
    pub content: String,
}

// ─── Download All Types ────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct DownloadAllOptions {
    pub book_id: i64,
    pub book_title: String,
    pub save_dir: String,
    pub mode: String, // "single", "chunked", "split"
    pub chunk_size: Option<i32>,
    pub delay_ms: Option<u64>,
    pub threads: Option<u32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DownloadAllProgressEvent {
    pub current: usize,
    pub total: usize,
    pub current_title: String,
    pub success: usize,
    pub failed: usize,
    pub status: String,
    pub message: Option<String>,
}
