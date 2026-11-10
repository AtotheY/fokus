//! Local, bounded request/reply transport. The service owns the pipe and its ACL.
use serde_json::Value;
use std::{io, path::PathBuf};
use windows_sys::Win32::System::Pipes::CallNamedPipeW;

pub const SERVICE_NAME: &str = "FokusBlocker";
pub const PIPE: &str = r"\\.\pipe\dev.usefokus.blocker";
pub fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}
pub fn base() -> PathBuf {
    // Ask Windows rather than trusting a caller-controlled environment variable.
    let mut path = [0u16; 260];
    let result = unsafe {
        windows_sys::Win32::UI::Shell::SHGetFolderPathW(
            std::ptr::null_mut(),
            0x23,
            std::ptr::null_mut(),
            0,
            path.as_mut_ptr(),
        )
    };
    assert!(result >= 0, "Windows could not locate ProgramData");
    let end = path.iter().position(|&c| c == 0).unwrap_or(path.len());
    PathBuf::from(String::from_utf16_lossy(&path[..end])).join("Fokus")
}
pub fn hosts() -> PathBuf {
    let mut path = [0u16; 260];
    let len = unsafe {
        windows_sys::Win32::System::SystemInformation::GetSystemDirectoryW(
            path.as_mut_ptr(),
            path.len() as u32,
        )
    };
    assert!(
        len > 0 && len < path.len() as u32,
        "Windows could not locate System32"
    );
    PathBuf::from(String::from_utf16_lossy(&path[..len as usize])).join(r"drivers\etc\hosts")
}
pub fn pipe() -> String {
    if let Ok(dir) = std::env::var("FOKUS_TEST_DIRECTORY") {
        // Stable across app/helper processes, distinct from the production pipe.
        let hash = dir
            .to_lowercase()
            .bytes()
            .fold(0xcbf29ce484222325u64, |h, b| {
                (h ^ b as u64).wrapping_mul(0x100000001b3)
            });
        format!(r"\\.\pipe\dev.usefokus.test.{hash:x}")
    } else {
        PIPE.into()
    }
}
pub fn request(action: &Value) -> Result<Value, String> {
    let input = serde_json::to_vec(action).map_err(|e| e.to_string())?;
    if input.len() > 8192 {
        return Err("This edit is too large. Add fewer items at once.".into());
    }
    let mut output = vec![0u8; 200_000];
    let mut count = 0;
    let ok = unsafe {
        CallNamedPipeW(
            wide(&pipe()).as_ptr(),
            input.as_ptr().cast(),
            input.len() as u32,
            output.as_mut_ptr().cast(),
            output.len() as u32,
            &mut count,
            6000,
        )
    };
    if ok == 0 {
        return Err(io::Error::last_os_error().to_string());
    }
    let response: Value =
        serde_json::from_slice(&output[..count as usize]).map_err(|e| e.to_string())?;
    if let Some(error) = response["error"].as_str() {
        Err(error.into())
    } else {
        Ok(response)
    }
}
