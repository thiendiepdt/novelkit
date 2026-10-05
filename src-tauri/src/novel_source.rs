//! Read-only fetches from Chinese novel sites (Fanqie, QQ Reading, Qidian, Qimao, SFACG, Faloo, JJWXC, Ciweimao).
//!
//! Used by the TTC "create story" AI-fill flow: the webview cannot call these
//! sites itself (CORS, and their WAFs reject a webview `Origin`), so the request
//! is made here and the body is parsed in the frontend (`ttc-uploader/sources`).
//! Text is only fetched from an allowlist of hosts. Images may come from any public
//! https host (covers are hot-linked from anywhere), with the checks described at
//! `check_public_https`. Neither command is a general-purpose proxy.

use serde::Serialize;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::AppHandle;
use url::Url;

use crate::net::describe_request_error;
use crate::ttc::client::get_client;

const DESKTOP_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MOBILE_UA: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;

// Cover CDNs (byteimg in particular) are flaky from outside mainland China: a cold
// connection can take 10s+ or drop, while the next attempt answers in under a second.
// Ciweimao's cover host has been measured at 10-30s for a 120KB image.
const IMAGE_TIMEOUT: Duration = Duration::from_secs(45);
const IMAGE_ATTEMPTS: usize = 2;
const IMAGE_RETRY_DELAY: Duration = Duration::from_millis(600);

/// A metadata host we are willing to fetch text from, and how to present ourselves to it.
struct TextSource {
    host: &'static str,
    user_agent: &'static str,
    referer: Option<&'static str>,
}

const TEXT_SOURCES: [TextSource; 9] = [
    // Book page with `window.__INITIAL_STATE__`.
    TextSource {
        host: "fanqienovel.com",
        user_agent: DESKTOP_UA,
        referer: Some("https://fanqienovel.com/"),
    },
    // Mobile site: www.qidian.com answers HTTP 202 with a JS probe instead of the page.
    TextSource {
        host: "m.qidian.com",
        user_agent: MOBILE_UA,
        referer: None,
    },
    // Public, unsigned detail endpoint of QQ Reading.
    TextSource {
        host: "detailadr.reader.qq.com",
        user_agent: MOBILE_UA,
        referer: None,
    },
    // Server-rendered book page.
    TextSource {
        host: "www.qimao.com",
        user_agent: DESKTOP_UA,
        referer: None,
    },
    // Mobile book page (full synopsis) and mobile chapter page (to find the book of a chapter link).
    TextSource {
        host: "m.sfacg.com",
        user_agent: MOBILE_UA,
        referer: None,
    },
    // Desktop book page: the only place SFACG lists a book's tags.
    TextSource {
        host: "book.sfacg.com",
        user_agent: DESKTOP_UA,
        referer: None,
    },
    // Book page in GB2312: `Response::text` decodes it from the declared charset.
    TextSource {
        host: "b.faloo.com",
        user_agent: DESKTOP_UA,
        referer: None,
    },
    // App endpoint: UTF-8 JSON (the web pages are GB18030 HTML without a charset header).
    TextSource {
        host: "app.jjwxc.net",
        user_agent: MOBILE_UA,
        referer: None,
    },
    TextSource {
        host: "www.ciweimao.com",
        user_agent: DESKTOP_UA,
        referer: None,
    },
];

/// Names that only resolve inside a private network.
const LOCAL_DOMAIN_SUFFIXES: [&str; 7] = [
    ".localhost",
    ".local",
    ".internal",
    ".intranet",
    ".lan",
    ".home",
    ".corp",
];

/// A domain name on the public internet: dotted, and not a private-network name.
fn is_public_domain(domain: &str) -> bool {
    let domain = domain.trim_end_matches('.').to_ascii_lowercase();
    domain.contains('.') && !LOCAL_DOMAIN_SUFFIXES.iter().any(|suffix| domain.ends_with(suffix))
}

/// Cover images cannot be held to a host list: JJWXC authors hot-link theirs from Baidu,
/// Weibo or any image host. So the rule is about the *kind* of target instead: https, a
/// public domain name (never an IP literal, `localhost` or an intranet name), the same
/// for every redirect hop, and a body that really is an image. That keeps a URL taken
/// from a third-party page from pointing this app at something on the local network.
fn check_public_https(url: &Url) -> Result<(), String> {
    if url.scheme() != "https" {
        return Err("Chỉ hỗ trợ URL https".to_string());
    }
    match url.host() {
        Some(url::Host::Domain(domain)) if is_public_domain(domain) => Ok(()),
        _ => Err(format!(
            "Máy chủ ảnh không hợp lệ: {}",
            url.host_str().unwrap_or_default()
        )),
    }
}

/// Client for cover downloads: like the shared one, but it re-checks every redirect.
/// Built once for the process (the redirect policy is a client-level setting in reqwest).
fn image_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .http1_allow_obsolete_multiline_headers_in_responses(true)
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 5 {
                    attempt.error("too many redirects")
                } else if check_public_https(attempt.url()).is_ok() {
                    attempt.follow()
                } else {
                    // Hand back the 3xx itself: it is then reported as a failed download.
                    attempt.stop()
                }
            }))
            .build()
            .expect("failed to initialize the image HTTP client")
    })
}

fn parse_https(url: &str) -> Result<Url, String> {
    let parsed = Url::parse(url.trim()).map_err(|e| format!("URL không hợp lệ: {}", e))?;
    if parsed.scheme() != "https" {
        return Err("Chỉ hỗ trợ URL https".to_string());
    }
    Ok(parsed)
}

fn text_source(url: &str) -> Result<(Url, &'static TextSource), String> {
    let parsed = parse_https(url)?;
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    let source = TEXT_SOURCES
        .iter()
        .find(|s| s.host == host)
        .ok_or_else(|| format!("Nguồn không được hỗ trợ: {}", host))?;
    Ok((parsed, source))
}

fn image_url(url: &str) -> Result<Url, String> {
    let parsed = Url::parse(url.trim()).map_err(|e| format!("URL không hợp lệ: {}", e))?;
    check_public_https(&parsed)?;
    Ok(parsed)
}

/// Image type from magic bytes (the formats TTC accepts as a cover).
fn sniff_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some("image/png")
    } else if bytes.starts_with(b"GIF8") {
        Some("image/gif")
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

/// Fetch a metadata page/endpoint from one of the allowlisted hosts.
pub async fn fetch_text(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let (parsed, source) = text_source(url)?;

    let mut request = client
        .get(parsed)
        .header("User-Agent", source.user_agent)
        .header("Accept", "text/html,application/json;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "zh-CN,zh;q=0.9")
        .timeout(REQUEST_TIMEOUT);
    if let Some(referer) = source.referer {
        request = request.header("Referer", referer);
    }

    let resp = request
        .send()
        .await
        .map_err(|e| format!("Không tải được dữ liệu từ {}: {}", source.host, describe_request_error(&e)))?;

    let status = resp.status();
    // 202 is how these sites serve their anti-bot probe page: there is no book data in it.
    if !status.is_success() || status.as_u16() == 202 {
        return Err(format!("{} trả về HTTP {}", source.host, status));
    }

    resp.text()
        .await
        .map_err(|e| format!("Không đọc được phản hồi từ {}: {}", source.host, describe_request_error(&e)))
}

#[tauri::command]
pub async fn source_fetch_text(app: AppHandle, url: String) -> Result<String, String> {
    fetch_text(&get_client(&app), &url).await
}

#[derive(Debug, Serialize)]
pub struct SourceImage {
    pub bytes: Vec<u8>,
    pub mime: String,
}

/// A failed image download: `Transient` is worth another attempt, `Fatal` is not.
#[derive(Debug, PartialEq)]
enum ImageError {
    Transient(String),
    Fatal(String),
}

/// 5xx and 429 come and go on a CDN; any other status will not change on retry.
fn status_error(status: reqwest::StatusCode) -> ImageError {
    let message = format!("máy chủ ảnh trả về HTTP {}", status);
    if status.is_server_error() || status.as_u16() == 429 {
        ImageError::Transient(message)
    } else {
        ImageError::Fatal(message)
    }
}

async fn try_fetch_image(client: &reqwest::Client, url: Url) -> Result<SourceImage, ImageError> {
    let resp = client
        .get(url)
        .header("User-Agent", DESKTOP_UA)
        .timeout(IMAGE_TIMEOUT)
        .send()
        .await
        .map_err(|e| ImageError::Transient(describe_request_error(&e)))?;

    if !resp.status().is_success() {
        return Err(status_error(resp.status()));
    }

    // A connection dropped mid-body is as transient as one that never opened.
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| ImageError::Transient(describe_request_error(&e)))?;

    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(ImageError::Fatal("ảnh quá lớn (trên 10MB)".to_string()));
    }

    // Magic bytes, not the Content-Type header: the host is not one we chose.
    let mime = sniff_image_mime(&bytes)
        .map(str::to_string)
        .ok_or_else(|| ImageError::Fatal("dữ liệu tải về không phải ảnh JPEG, PNG, WebP hay GIF".to_string()))?;

    Ok(SourceImage {
        bytes: bytes.to_vec(),
        mime,
    })
}

/// Download a cover image from one of the allowlisted CDNs, retrying transient failures.
pub async fn fetch_image(client: &reqwest::Client, url: &str) -> Result<SourceImage, String> {
    let parsed = image_url(url)?;

    let mut last = String::new();
    for attempt in 1..=IMAGE_ATTEMPTS {
        match try_fetch_image(client, parsed.clone()).await {
            Ok(image) => return Ok(image),
            Err(ImageError::Fatal(message)) => return Err(format!("Không tải được ảnh bìa: {}", message)),
            Err(ImageError::Transient(message)) => {
                log::warn!("Cover download attempt {}/{} failed for {}: {}", attempt, IMAGE_ATTEMPTS, parsed, message);
                last = message;
                if attempt < IMAGE_ATTEMPTS {
                    tokio::time::sleep(IMAGE_RETRY_DELAY).await;
                }
            }
        }
    }

    Err(format!(
        "Không tải được ảnh bìa sau {} lần thử: {}",
        IMAGE_ATTEMPTS, last
    ))
}

#[tauri::command]
pub async fn source_fetch_image(url: String) -> Result<SourceImage, String> {
    fetch_image(image_client(), &url).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_source_accepts_only_exact_allowlisted_hosts() {
        assert_eq!(
            text_source("https://fanqienovel.com/page/7069948840148732967")
                .unwrap()
                .1
                .host,
            "fanqienovel.com"
        );
        assert_eq!(
            text_source("https://m.qidian.com/book/1010868264/")
                .unwrap()
                .1
                .host,
            "m.qidian.com"
        );
        assert!(text_source(
            "https://detailadr.reader.qq.com/book/queryDetailPage?bid=59366432"
        )
        .is_ok());

        assert!(text_source("https://www.qimao.com/shuku/10021482/").is_ok());
        assert!(text_source("https://m.sfacg.com/b/759334/").is_ok());
        assert!(text_source("https://book.sfacg.com/Novel/759334/").is_ok());
        assert!(text_source("https://b.faloo.com/550081.html").is_ok());
        assert!(text_source("https://app.jjwxc.net/androidapi/novelbasicinfo?novelId=4468196").is_ok());
        assert!(text_source("https://www.ciweimao.com/book/100339985").is_ok());
        // Only the hosts we fetch from: a pasted mirror domain never reaches the network.
        assert!(text_source("https://m.jjwxcbroken.net/book2/4468196/1").is_err());

        assert!(text_source("https://example.com/").is_err());
        assert!(text_source("https://fanqienovel.com.evil.example/page/1").is_err());
        assert!(text_source("https://evil.example/?u=m.qidian.com").is_err());
    }

    #[test]
    fn text_source_rejects_non_https_and_garbage() {
        assert!(text_source("http://m.qidian.com/book/1/").is_err());
        assert!(text_source("file:///C:/Windows/win.ini").is_err());
        assert!(text_source("not a url").is_err());
    }

    #[test]
    fn image_url_accepts_any_public_https_host() {
        assert!(image_url("https://p6-novel.byteimg.com/novel-pic/abc~tplv-shrink:640:0.image").is_ok());
        assert!(image_url("https://bookcover.yuewen.com/qdbimg/349573/1010868264/600").is_ok());
        // JJWXC covers are hot-linked from wherever the author uploaded them.
        assert!(image_url("https://pic.rmb.bdstatic.com/bjh/portrait/e8210b76.jpeg").is_ok());
        assert!(image_url("https://wx1.sinaimg.cn/large/abc.jpg").is_ok());
    }

    #[test]
    fn image_url_rejects_anything_that_is_not_a_public_https_domain() {
        // Not https.
        assert!(image_url("http://p6-novel.byteimg.com/origin/novel-pic/abc").is_err());
        assert!(image_url("file:///C:/Windows/win.ini").is_err());
        // IP literals in every spelling the URL parser normalizes.
        assert!(image_url("https://127.0.0.1/a.jpg").is_err());
        assert!(image_url("https://192.168.1.1/a.jpg").is_err());
        assert!(image_url("https://[::1]/a.jpg").is_err());
        assert!(image_url("https://2130706433/a.jpg").is_err());
        assert!(image_url("https://0x7f.0.0.1/a.jpg").is_err());
        // Names that stay inside the local network.
        assert!(image_url("https://localhost/a.jpg").is_err());
        assert!(image_url("https://router/a.jpg").is_err());
        assert!(image_url("https://nas.local/a.jpg").is_err());
        assert!(image_url("https://git.corp/a.jpg").is_err());
        assert!(image_url("https://printer.lan./a.jpg").is_err());
    }

    #[test]
    fn only_server_side_statuses_are_retried() {
        use reqwest::StatusCode;
        assert!(matches!(status_error(StatusCode::BAD_GATEWAY), ImageError::Transient(_)));
        assert!(matches!(status_error(StatusCode::TOO_MANY_REQUESTS), ImageError::Transient(_)));
        assert!(matches!(status_error(StatusCode::NOT_FOUND), ImageError::Fatal(_)));
        assert!(matches!(status_error(StatusCode::FORBIDDEN), ImageError::Fatal(_)));
    }

    #[test]
    fn sniffs_common_image_types() {
        assert_eq!(sniff_image_mime(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
        assert_eq!(sniff_image_mime(&[0x89, b'P', b'N', b'G', 0x0D]), Some("image/png"));
        assert_eq!(sniff_image_mime(b"GIF89a"), Some("image/gif"));
        assert_eq!(sniff_image_mime(b"RIFF\x00\x00\x00\x00WEBPVP8 "), Some("image/webp"));
        assert_eq!(sniff_image_mime(b"<html>"), None);
    }

    /// Live check against the real sites. Run with: cargo test live_ -- --ignored --nocapture
    #[test]
    #[ignore]
    fn live_sources_serve_book_data() {
        let client = crate::ttc::client::build_http_client();
        tauri::async_runtime::block_on(async {
            let fanqie = fetch_text(&client, "https://fanqienovel.com/page/7069948840148732967")
                .await
                .expect("fanqie");
            assert!(fanqie.contains("__INITIAL_STATE__"), "fanqie: no state");

            let qidian = fetch_text(&client, "https://m.qidian.com/book/1010868264/")
                .await
                .expect("qidian");
            assert!(qidian.contains("vite-plugin-ssr_pageContext"), "qidian: no page context");

            let qq = fetch_text(
                &client,
                "https://detailadr.reader.qq.com/book/queryDetailPage?bid=59366432&sex=1&qmk=1,3,7,9,10",
            )
            .await
            .expect("qq");
            assert!(qq.contains("introinfo"), "qq: no introinfo");

            let qimao = fetch_text(&client, "https://www.qimao.com/shuku/10021482/")
                .await
                .expect("qimao");
            assert!(qimao.contains("book-information"), "qimao: no book block");

            let sfacg = fetch_text(&client, "https://m.sfacg.com/b/759334/")
                .await
                .expect("sfacg mobile");
            assert!(sfacg.contains("book_newtitle"), "sfacg: no title");

            let sfacg_desktop = fetch_text(&client, "https://book.sfacg.com/Novel/759334/")
                .await
                .expect("sfacg desktop");
            assert!(sfacg_desktop.contains("tag-list"), "sfacg desktop: no tags");

            let sfacg_chapter = fetch_text(&client, "https://m.sfacg.com/c/9360421/")
                .await
                .expect("sfacg chapter");
            assert!(sfacg_chapter.contains("/b/759334/"), "sfacg chapter: no back link");

            let cover = fetch_image(image_client(), "https://bookcover.yuewen.com/qdbimg/349573/1010868264/600")
                .await
                .expect("cover");
            assert_eq!(cover.mime, "image/jpeg");
            assert!(cover.bytes.len() > 1000);

            // GB2312 page: readable Chinese proves the charset decoding works.
            let faloo = fetch_text(&client, "https://b.faloo.com/550081.html")
                .await
                .expect("faloo");
            assert!(faloo.contains("我能复制天赋"), "faloo: title not decoded from GB2312");

            let jjwxc = fetch_text(&client, "https://app.jjwxc.net/androidapi/novelbasicinfo?novelId=4468196")
                .await
                .expect("jjwxc");
            assert!(jjwxc.contains("novelName"), "jjwxc: no novelName");

            let ciweimao = fetch_text(&client, "https://www.ciweimao.com/book/100339985")
                .await
                .expect("ciweimao");
            assert!(ciweimao.contains("og:novel:book_name"), "ciweimao: no og tags");

            for url in [
                "https://img.faloo.com/Novel/498x705/1/1030/001030475.jpg",
                // (Baidu-hosted JJWXC covers are deliberately not checked here: that host swings
                // between seconds and a timeout from abroad, which would make this test flaky.)
                "https://i4-static.jjwxc.net/tmp/backend/authorspace/s1/3/2087/208622/20230519211356_300_420.jpg",
                // c1, not the e1/e2 hosts the pages link: those time out from outside mainland China.
                "https://c1.kuangxiangit.com/uploads/allimg/c240806/06-08-24032600-43371.jpg",
                "https://cdn.wtzw.com/bookimg/public/images/cover/f0e5/9c3c9ab728c51bde1b02ac5eb330216b_360x480.png",
                "https://rs.sfacg.com/web/novel/images/NovelCover/Big/2026/05/dbdee7c5-9023-4c8d-989c-f1e81060aa57.jpg",
            ] {
                let image = fetch_image(image_client(), url).await.expect(url);
                assert!(image.mime.starts_with("image/"), "{}: {}", url, image.mime);
                assert!(image.bytes.len() > 1000, "{}: too small", url);
            }

            let fanqie_cover = fetch_image(
                image_client(),
                "https://p6-novel.byteimg.com/novel-pic/83d326b67a551f57c169f851d100dfeb~tplv-shrink:640:0.image",
            )
            .await
            .expect("fanqie cover");
            assert!(fanqie_cover.mime.starts_with("image/"));
            assert!(fanqie_cover.bytes.len() > 1000);
        });
    }
}
