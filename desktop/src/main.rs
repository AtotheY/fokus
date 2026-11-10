#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]
#[cfg(target_os = "macos")]
include!("mac_main.rs");
#[cfg(windows)]
include!("windows_main.rs");
