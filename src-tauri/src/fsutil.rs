//! Small file helpers shared by the modules that persist app data.

use std::io::Write;
use std::path::Path;

/// Replace `path` with `bytes` without ever leaving a half-written file behind: the data
/// goes to a sibling temp file first, which is then renamed over the target (atomic on
/// the same volume). The parent directory is created when missing.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut tmp_name = path.file_name().unwrap_or_default().to_os_string();
    tmp_name.push(".tmp");
    let tmp = path.with_file_name(tmp_name);
    {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    std::fs::rename(&tmp, path)
}

#[cfg(test)]
pub mod test_dir {
    use std::path::PathBuf;

    /// A fresh, empty directory under the system temp dir, removed when dropped.
    pub struct TempDir(pub PathBuf);

    impl TempDir {
        pub fn new(label: &str) -> Self {
            let unique = format!(
                "novelkit-test-{}-{}-{}",
                label,
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            );
            let dir = std::env::temp_dir().join(unique);
            std::fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.0).ok();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_dir::TempDir;
    use super::*;

    #[test]
    fn write_atomic_creates_and_replaces_without_leaving_the_temp_file() {
        let dir = TempDir::new("fsutil");
        let target = dir.0.join("nested").join("data.json");

        write_atomic(&target, b"one").unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "one");
        write_atomic(&target, b"two").unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "two");
        assert!(!dir.0.join("nested").join("data.json.tmp").exists());
    }
}
