// One empty request per active UTC day. The date stays on the Mac.
// Claim before sending, so an ambiguous timeout or crash cannot count twice.
use std::fs::OpenOptions;
use std::io::{Read, Seek, Write};
use std::os::unix::{fs::OpenOptionsExt, io::AsRawFd};
use std::path::Path;
use std::process::{Command, Stdio};

fn count_once(path: &Path, day: &str, send: impl FnOnce() -> bool) -> std::io::Result<bool> {
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .mode(0o600)
        .open(path)?;
    if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX) } != 0 {
        return Err(std::io::Error::last_os_error());
    }
    let mut previous = String::new();
    file.read_to_string(&mut previous)?;
    if previous.as_str() >= day {
        return Ok(true);
    }
    file.rewind()?;
    file.write_all(day.as_bytes())?;
    file.set_len(day.len() as u64)?;
    file.sync_data()?;
    if !send() {
        // Only retry when we know the request never reached the collector.
        file.set_len(0)?;
        return Ok(false);
    }
    Ok(true)
}

#[tauri::command]
pub async fn count_active_day(app: tauri::AppHandle) -> Result<bool, String> {
    if cfg!(debug_assertions)
        || super::sandbox().is_some()
        || std::env::var_os("FOKUS_DISABLE_ACTIVE_COUNT").is_some()
    {
        return Ok(true);
    }
    let marker = super::data(&app)?.join("last-active-count-day");
    tauri::async_runtime::spawn_blocking(move || {
        let day = chrono::Utc::now().date_naive().to_string();
        count_once(&marker, &day, || {
            // -q first ignores .curlrc. No cookies, redirects, version or payload.
            let status = Command::new("/usr/bin/curl")
                .args([
                    "-q",
                    "--silent",
                    "--max-time",
                    "6",
                    "--connect-timeout",
                    "3",
                    "--user-agent",
                    "Fokus",
                    "--header",
                    "X-Fokus-Count: 1",
                    "--request",
                    "POST",
                    "https://usefokus.dev/api/active",
                ])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
            match status {
                Ok(exit) => !matches!(exit.code(), Some(5 | 6 | 7)),
                Err(_) => false,
            }
        })
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restarts_retries_and_rollover() {
        let path = std::env::temp_dir().join(format!(
            "fokus-activity-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        assert!(!count_once(&path, "2026-11-09", || false).unwrap());
        assert!(count_once(&path, "2026-11-09", || true).unwrap());
        assert!(count_once(&path, "2026-11-09", || panic!("duplicate send")).unwrap());
        assert!(count_once(&path, "2026-11-10", || true).unwrap());
        assert!(count_once(&path, "2026-11-09", || panic!("clock rollback")).unwrap());
        std::fs::remove_file(path).unwrap();
    }
}
