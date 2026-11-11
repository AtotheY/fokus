use crate::{query, socket_path};
use chrono::{Local, TimeZone};
use serde_json::{json, Value};
use std::{sync::mpsc, time::Duration};
#[cfg(target_os = "macos")]
use std::os::unix::net::UnixStream;
#[cfg(windows)]
use crate::WindowsConnection as UnixStream;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    App, AppHandle, Manager,
};

pub struct Refresh(mpsc::SyncSender<()>);
pub fn refresh(app: &AppHandle) {
    if let Some(signal) = app.try_state::<Refresh>() {
        let _ = signal.0.try_send(());
    }
}

pub fn show(app: &AppHandle, action: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.eval(format!(
            "window.dispatchEvent(new CustomEvent('fokus-menu',{{detail:{}}}))",
            json!(action)
        ));
    }
}

fn clock(timestamp: i64) -> String {
    Local
        .timestamp_opt(timestamp, 0)
        .single()
        .map(|t| t.format("%-I:%M %p").to_string())
        .unwrap_or_default()
}
fn labels(state: &Value) -> (String, &'static str) {
    if state["ready"] != true || !state["problem"].is_null() {
        return ("Setup required".into(), "Open blocker setup");
    }
    let now = state["now"].as_i64().unwrap_or(0);
    let end = state["sessionEnd"].as_i64().unwrap_or_else(|| {
        let scheduled = if state["scheduled"] == true {
            state["transition"].as_i64().unwrap_or(0)
        } else {
            0
        };
        scheduled.max(state["rules"]["focusUntil"].as_i64().unwrap_or(0))
    });
    let pause = state["rules"]["breakUntil"].as_i64().unwrap_or(0);
    if state["rules"]["sites"]
        .as_array()
        .is_some_and(|s| s.is_empty())
        && state["rules"]["groups"].as_array().is_none_or(|gs| {
            gs.iter().all(|g| {
                g["sites"].as_array().is_none_or(Vec::is_empty)
                    && g["apps"].as_array().is_none_or(Vec::is_empty)
            })
        })
    {
        return ("Empty block list".into(), "Add a website");
    }
    if pause > now && end > now {
        return (
            format!("Break until {}", clock(pause.min(end))),
            "Review break",
        );
    }
    if end > now {
        return (format!("Session until {}", clock(end)), "Take a break");
    }
    if state["skipped"] == true {
        return ("Working hours ended early".into(), "Review working hours");
    }
    ("Off the clock".into(), "Start a session")
}

pub fn install(app: &mut App) -> tauri::Result<()> {
    let status = MenuItem::with_id(app, "menu-status", "Fokus", false, None::<&str>)?;
    let quick = MenuItem::with_id(app, "menu-quick", "Session controls", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "menu-open", "Open Fokus", true, None::<&str>)?;
    let add = MenuItem::with_id(app, "menu-add", "Add a website", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "menu-quit", "Quit Fokus", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&status, &sep, &quick, &add, &open, &sep2, &quit])?;
    TrayIconBuilder::with_id("focus")
        .icon(if cfg!(windows) {
            tauri::include_image!("./icons/icon.png")
        } else {
            tauri::include_image!("./icons/status.png")
        })
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("Fokus")
        .menu(&menu)
        .build(app)?;
    let (tx, rx) = mpsc::sync_channel(1);
    app.manage(Refresh(tx));
    let handle = app.handle().clone();
    std::thread::spawn(move || {
        let mut previous = None;
        loop {
            let state = UnixStream::connect(socket_path())
                .ok()
                .and_then(|s| query(s, &json!({"type":"status"})).ok())
                .unwrap_or(Value::Null);
            crate::mac_apps::protect(&handle, &state["blockedApps"]);
            let next = labels(&state);
            if previous.as_ref() != Some(&next) {
                let _ = status.set_text(&next.0);
                let _ = quick.set_text(next.1);
                previous = Some(next);
            }
            let now = Local::now().timestamp();
            let seconds = [
                state["transition"].as_i64(),
                state["sessionEnd"].as_i64(),
                state["rules"]["breakUntil"].as_i64(),
            ]
            .into_iter()
            .flatten()
            .filter(|t| *t > now)
            .map(|t| (t - now) as u64)
            .fold(60, u64::min);
            let has_apps = state["rules"]["groups"].as_array().is_some_and(|v| {
                v.iter()
                    .any(|g| g["apps"].as_array().is_some_and(|a| !a.is_empty()))
            });
            let seconds = if has_apps && state["sessionEnd"].is_number() {
                seconds.min(1)
            } else {
                seconds
            };
            if let Err(mpsc::RecvTimeoutError::Disconnected) =
                rx.recv_timeout(Duration::from_secs(seconds))
            {
                break;
            }
        }
    });
    Ok(())
}
