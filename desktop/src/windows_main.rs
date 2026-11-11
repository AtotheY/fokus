use std::os::windows::process::CommandExt;
#[path = "windows_activity.rs"]
mod activity;

#[path = "windows_comet.rs"]
mod comet;
#[path = "windows_icons.rs"]
mod identity_icons;
#[path = "windows_apps.rs"]
mod mac_apps;
mod menubar;
mod puzzles;
use fokus::*;
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::Duration,
};
use tauri::{Manager, WebviewWindow};

struct Store(Mutex<()>);
fn sandbox() -> Option<PathBuf> {
    std::env::var_os("FOKUS_TEST_DIRECTORY").map(PathBuf::from)
}
// Adapter lets the shared tray use the platform request transport.
struct WindowsConnection;
impl WindowsConnection {
    fn connect(_: PathBuf) -> Result<Self, String> {
        fokus::windows_ipc::request(&json!({"type":"status"}))?;
        Ok(Self)
    }
}
use WindowsConnection as UnixStream;
fn socket_path() -> PathBuf {
    PathBuf::from(fokus::windows_ipc::pipe())
}
fn data(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = sandbox()
        .map(Ok)
        .unwrap_or_else(|| app.path().app_data_dir().map_err(|e| e.to_string()))?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}
fn pending(app: &tauri::AppHandle) -> Result<Rules, String> {
    let dir = data(app)?;
    let file = dir.join("pending.json");
    let mut rules = if file.exists() {
        load_rules(&file)?
    } else {
        Rules::default()
    };
    let marker = dir.join("pending-presets-v2-applied");
    if !marker.exists() {
        let changes = rules.preset_additions();
        if !changes.is_empty() {
            for (id, sites) in changes {
                rules.edit_group(GroupEdit::AddSites { id, sites }, chrono::Local::now())?;
            }
            write_atomic(
                &file,
                &serde_json::to_vec(&rules).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
        }
        write_atomic(&marker, b"1").map_err(|e| e.to_string())?;
    }
    Ok(rules)
}
fn query(_: WindowsConnection, action: &Value) -> Result<Value, String> {
    fokus::windows_ipc::request(action)
}
fn cache_rules(app: &tauri::AppHandle, rules: &Value) -> Result<(), String> {
    let file = data(app)?.join("pending.json");
    let bytes = serde_json::to_vec(rules).map_err(|e| e.to_string())?;
    if fs::read(&file).ok().as_deref() != Some(bytes.as_slice()) {
        write_atomic(&file, &bytes).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Helpers shipped before the catalogue already support ordinary group edits. Use
// their socket so installing new site data does not require macOS authorization.
fn upgrade_installed_presets(app: &tauri::AppHandle, state: &mut Value) -> Result<(), String> {
    let marker = data(app)?.join("presets-v2-applied");
    if !marker.exists() {
        let rules: Rules =
            serde_json::from_value(state["rules"].clone()).map_err(|e| e.to_string())?;
        for (id, sites) in rules.preset_additions() {
            let stream = UnixStream::connect(socket_path()).map_err(|e| e.to_string())?;
            *state = query(
                stream,
                &json!({"type":"group","change": {"op":"addSites", "id":id, "sites":sites}}),
            )?;
        }
        write_atomic(&marker, b"1").map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn focus_request(app: tauri::AppHandle, action: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let store = app.state::<Store>();
        let _guard = store.0.lock().map_err(|_| "Storage is busy.")?;
        if let Ok(stream) = UnixStream::connect(socket_path()) {
            let mut state = match query(stream, &action) {
                Ok(state) => state,
                Err(error) if action["type"] == "status" => {
                    let mut result = snapshot(
                        &pending(&app)?,
                        false,
                        Some(format!("The blocker stopped responding. {error}")),
                    );
                    result["installed"] = json!(true);
                    return Ok(result);
                }
                Err(error) => return Err(error),
            };
            if state["version"].as_u64().unwrap_or(0) >= 3 && action["type"] == "status" {
                if let Err(error) = upgrade_installed_presets(&app, &mut state) {
                    eprintln!("Could not finish updating the site presets: {error}");
                }
            }
            cache_rules(&app, &state["rules"])?;
            if state["version"].as_u64().unwrap_or(1) < 3 {
                // Continue using an installed v1 helper while its owner chooses when to upgrade.
                let rules: Rules =
                    serde_json::from_value(state["rules"].clone()).map_err(|e| e.to_string())?;
                let mut compatible = snapshot(
                    &rules,
                    state["ready"] == true,
                    state["problem"].as_str().map(String::from),
                );
                compatible["blocked"] = state["blocked"].clone();
                compatible["needsUpdate"] = json!(true);
                state = compatible;
            }
            state["installed"] = json!(true);
            if action["type"] != "status" {
                menubar::refresh(&app);
            }
            return Ok(state);
        }
        let installed =
            sandbox().is_none() && fokus::windows_ipc::base().join("fokus-helper.exe").exists();
        let mut rules = pending(&app)?;
        if action != json!({"type":"status"}) {
            if installed {
                return Err("Reconnect the blocker before editing your rules.".into());
            }
            rules.apply(
                serde_json::from_value(action).map_err(|e| e.to_string())?,
                chrono::Local::now().timestamp(),
            )?;
            write_atomic(
                &data(&app)?.join("pending.json"),
                &serde_json::to_vec(&rules).unwrap(),
            )
            .map_err(|e| e.to_string())?;
        }
        let mut result = snapshot(
            &rules,
            false,
            installed.then(|| {
                "The local helper is unavailable. Reconnect it to restore scheduled blocking."
                    .into()
            }),
        );
        result["installed"] = json!(installed);
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}
fn ps_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}
#[tauri::command]
async fn configure_helper(app: tauri::AppHandle, install: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if sandbox().is_some() { return Err("Helper setup is disabled in a test workspace.".into()); }
        let bin = std::env::current_exe().map_err(|e| e.to_string())?;
        let bin = bin.parent().ok_or("Missing app directory")?;
        let file = data(&app)?.join("pending.json");
        if install {
            let rules = pending(&app)?;
            write_atomic(&file, &serde_json::to_vec(&rules).unwrap()).map_err(|e| e.to_string())?;
        } else if let Ok(state) = fokus::windows_ipc::request(&json!({"type":"status"})) {
            cache_rules(&app, &state["rules"])?;
        }
        let script = bin.join(if install { "install-helper.ps1" } else { "uninstall-helper.ps1" });
        if !script.is_file() { return Err("Build the Windows package first; the helper setup script is missing.".into()); }
        let sid = Command::new("powershell.exe").creation_flags(0x08000000).args(["-NoProfile", "-NonInteractive", "-Command", "[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value"]).output().map_err(|e| e.to_string())?;
        let sid = String::from_utf8_lossy(&sid.stdout).trim().to_owned();
        let args = format!("-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{}\" -Source \"{}\" -Rules \"{}\" -OwnerSid {}", script.display(), bin.display(), file.display(), sid);
        let command = format!("try {{ $p = Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList {} -Wait -PassThru; exit $p.ExitCode }} catch {{ exit 1 }}", ps_quote(&args));
        let status = Command::new("powershell.exe").creation_flags(0x08000000).args(["-NoProfile", "-NonInteractive", "-Command", &command]).status().map_err(|e| e.to_string())?;
        if !status.success() { return Err("Windows blocker setup failed or administrator approval was cancelled. See C:\\ProgramData\\Fokus\\setup.log for details.".into()); }
        if install {
            for _ in 0..50 {
                if fokus::windows_ipc::request(&json!({"type":"status"})).is_ok() { menubar::refresh(&app); return Ok(()); }
                std::thread::sleep(Duration::from_millis(100));
            }
            return Err("The service was installed but has not started. Try reconnecting.".into());
        }
        menubar::refresh(&app);
        Ok(())
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
fn preview_schedule(mut rules: Rules, schedule: Schedule) -> Result<Value, String> {
    rules.apply(
        Action::Schedule { schedule },
        chrono::Local::now().timestamp(),
    )?;
    Ok(snapshot(&rules, true, None))
}

#[tauri::command]
fn open_website(site: String) -> Result<(), String> {
    let host = domain(&site)?;
    Command::new("explorer.exe")
        .arg(format!("https://{host}/"))
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn check_website(site: String) -> Result<Value, String> {
    use std::net::ToSocketAddrs;
    let host = domain(&site)?;
    tauri::async_runtime::spawn_blocking(move || {
        let addresses = (host.as_str(), 443).to_socket_addrs().map_err(|_| {
            "Windows could not resolve this site. Check your connection or VPN and try again."
        })?;
        let mut sink = false;
        let mut other = false;
        for address in addresses {
            let ip = address.ip();
            if ip.is_unspecified() || ip.is_loopback() {
                sink = true;
            } else {
                other = true;
            }
        }
        Ok(json!({"host":host,"resolution": match (sink,other) {
            (true,false)=>"blocked", (false,true)=>"routable", (true,true)=>"mixed", _=>"unknown"
        }}))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn site_scope(site: String) -> Result<Value, String> {
    let site = domain(&site)?;
    Ok(json!({"site":site,"hosts":hostnames(std::slice::from_ref(&site))}))
}

#[tauri::command]
fn appearance(window: WebviewWindow, icon: String, mode: String, blur: bool) -> Result<(), String> {
    let theme = match mode.as_str() {
        "dark" => Some(tauri::Theme::Dark),
        "light" => Some(tauri::Theme::Light),
        _ => None,
    };
    window.set_theme(theme).map_err(|e| e.to_string())?;
    if !icon.bytes().all(|c| c.is_ascii_lowercase()) || icon.is_empty() {
        return Err("Unknown finish".into());
    }
    let path = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .with_file_name("icons")
        .join(format!("{icon}.png"));
    if path.exists() {
        let image = tauri::image::Image::from_path(path).map_err(|e| e.to_string())?;
        window.set_icon(image).map_err(|e| e.to_string())?;
    }
    let _ = blur; // Windows keeps a native, opaque window for consistent WebView rendering.
    Ok(())
}

#[tauri::command]
fn theme_files(
    app: tauri::AppHandle,
    open: bool,
) -> Result<std::collections::BTreeMap<String, String>, String> {
    let dir = data(&app)?.join("Themes");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let seeded = dir.join(".bundled-v1");
    if !seeded.exists() {
        let bundled = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .with_file_name("themes");
        for item in fs::read_dir(bundled).map_err(|e| e.to_string())? {
            let item = item.map_err(|e| e.to_string())?;
            let target = dir.join(item.file_name());
            if !target.exists() && item.path().extension().and_then(|s| s.to_str()) == Some("css") {
                fs::copy(item.path(), target).map_err(|e| e.to_string())?;
            }
        }
        fs::write(seeded, b"").map_err(|e| e.to_string())?;
    }
    if open {
        Command::new("explorer.exe")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    let mut files = std::collections::BTreeMap::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())?.flatten() {
        let p = entry.path();
        if p.extension().and_then(|s| s.to_str()) != Some("css")
            || !entry.file_type().is_ok_and(|t| t.is_file())
            || !entry.metadata().is_ok_and(|m| m.len() < 65536)
        {
            continue;
        }
        if let (Some(n), Ok(css)) = (
            p.file_stem().and_then(|s| s.to_str()),
            fs::read_to_string(&p),
        ) {
            files.insert(n.into(), css);
        }
    }
    Ok(files)
}
fn main() {
    tauri::Builder::default()
        .manage(Store(Mutex::new(())))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(monitor) = window.current_monitor()? {
                    let area = monitor.work_area();
                    let outer = window.outer_size()?;
                    let inner = window.inner_size()?;
                    let frame_x = outer.width.saturating_sub(inner.width);
                    let frame_y = outer.height.saturating_sub(inner.height);
                    let margin = (16.0 * monitor.scale_factor()) as u32;
                    let max_width = area.size.width.saturating_sub(frame_x + margin * 2).max(1);
                    let max_height = area.size.height.saturating_sub(frame_y + margin * 2).max(1);
                    let width = inner.width.min(max_width);
                    let height = inner.height.min(max_height);
                    window.set_min_size(Some(tauri::PhysicalSize::new(
                        ((430.0 * monitor.scale_factor()) as u32).min(max_width),
                        ((490.0 * monitor.scale_factor()) as u32).min(max_height),
                    )))?;
                    window.set_size(tauri::PhysicalSize::new(width, height))?;
                    window.set_position(tauri::PhysicalPosition::new(
                        area.position.x
                            + (area.size.width.saturating_sub(width + frame_x) / 2) as i32,
                        area.position.y
                            + (area.size.height.saturating_sub(height + frame_y) / 2) as i32,
                    ))?;
                }
            }
            menubar::install(app)?;
            comet::install(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .on_menu_event(|app, e| match e.id().as_ref() {
            "menu-quit" => app.exit(0),
            "menu-open" => menubar::show(app, "open"),
            "menu-quick" => menubar::show(app, "quick"),
            "menu-add" => menubar::show(app, "add"),
            "settings" => menubar::show(app, "settings"),
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            mac_apps::installed_apps,
            identity_icons::app_icon,
            identity_icons::site_icon,
            mac_apps::open_game,
            puzzles::new_board,
            focus_request,
            activity::count_active_day,
            configure_helper,
            appearance,
            theme_files,
            check_website,
            site_scope,
            preview_schedule,
            open_website,
            comet::comet_status,
            comet::open_automation_settings
        ])
        .build(tauri::generate_context!())
        .expect("Could not open Fokus")
        .run(|_, _| {});
}
