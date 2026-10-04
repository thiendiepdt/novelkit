//! Helpers for reporting outbound HTTP failures.

use std::error::Error;

/// Innermost cause of an error chain, or `None` when the error has no source.
fn root_cause(e: &dyn Error) -> Option<String> {
    let mut root = None;
    let mut source = e.source();
    while let Some(cause) = source {
        let text = cause.to_string();
        if !text.is_empty() {
            root = Some(text);
        }
        source = cause.source();
    }
    root
}

/// A certificate that fails validation on a well-known site almost never means the
/// site is broken: it is what a dropped connection looks like when a router, captive
/// portal or ISP answers in the site's place. Say so, or the raw TLS error reads like
/// a bug in the app.
const CERTIFICATE_HINT: &str =
    "chứng chỉ máy chủ không hợp lệ, thường do mất mạng hoặc mạng đang bị chặn/chuyển hướng; hãy kiểm tra kết nối rồi thử lại";

fn describe(kind: &str, e: &dyn Error) -> String {
    match root_cause(e) {
        Some(root) if root.to_ascii_lowercase().contains("certificate") => {
            format!("{} ({})", CERTIFICATE_HINT, root)
        }
        Some(root) => format!("{} ({})", kind, root),
        None => kind.to_string(),
    }
}

/// Why a request failed, in words the user can act on.
///
/// reqwest's own `Display` stops at "error sending request for url (...)", which
/// hides whether it timed out, was refused, or failed in DNS/TLS. This names the
/// kind and appends the innermost cause.
pub fn describe_request_error(e: &reqwest::Error) -> String {
    let kind = if e.is_timeout() {
        "hết thời gian chờ"
    } else if e.is_connect() {
        "không kết nối được máy chủ"
    } else {
        "lỗi mạng"
    };
    describe(kind, e)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fmt;

    #[derive(Debug)]
    struct Layer(&'static str, Option<Box<Layer>>);

    impl fmt::Display for Layer {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str(self.0)
        }
    }

    impl Error for Layer {
        fn source(&self) -> Option<&(dyn Error + 'static)> {
            self.1.as_deref().map(|inner| inner as &(dyn Error + 'static))
        }
    }

    #[test]
    fn appends_the_innermost_cause() {
        let err = Layer(
            "error sending request",
            Some(Box::new(Layer(
                "client error (Connect)",
                Some(Box::new(Layer("connection reset by peer", None))),
            ))),
        );
        assert_eq!(
            describe("lỗi mạng", &err),
            "lỗi mạng (connection reset by peer)"
        );
    }

    #[test]
    fn certificate_failures_point_at_the_network_not_the_site() {
        let err = Layer(
            "error sending request",
            Some(Box::new(Layer("invalid peer certificate: UnknownIssuer", None))),
        );
        let text = describe("không kết nối được máy chủ", &err);
        assert!(text.contains("mất mạng"), "{}", text);
        assert!(text.contains("kiểm tra kết nối"), "{}", text);
        assert!(text.ends_with("(invalid peer certificate: UnknownIssuer)"), "{}", text);
    }

    #[test]
    fn falls_back_to_the_kind_when_there_is_no_cause() {
        assert_eq!(describe("hết thời gian chờ", &Layer("timeout", None)), "hết thời gian chờ");
    }
}
