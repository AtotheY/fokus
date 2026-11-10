mod activity;
mod updater;
mod comet;
mod mac_apps;
mod identity_icons;
mod menubar;
mod puzzles;
use fokus::*;
use serde_json::{json, Value};
use std::{
    fs,
    io::{Read, Write},
    net::Shutdown,
    os::unix::net::UnixStream,
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
fn socket_path() -> PathBuf {
    sandbox()
        .map(|p| p.join("control.sock"))
        .unwrap_or_else(|| PathBuf::from(SOCKET))
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
    let marker = dir.join("pending-presets-v1-applied");
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
fn query(mut stream: UnixStream, action: &Value) -> Result<Value, String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(6)))
        .map_err(|e| e.to_string())?;
    stream
        .write_all(action.to_string().as_bytes())
        .map_err(|e| e.to_string())?;
    stream
        .shutdown(Shutdown::Write)
        .map_err(|e| e.to_string())?;
    let response: Value =
        serde_json::from_reader(stream.take(200000)).map_err(|e| e.to_string())?;
    if let Some(s) = response["error"].as_str() {
        return Err(s.into());
    }
    Ok(response)
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
    let marker = data(app)?.join("presets-v1-applied");
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
        let installed = sandbox().is_none() && Path::new(SERVICE).join("fokus-helper").exists();
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
fn authorized(script: &Path, args: &[&Path]) -> Result<(), String> {
    let source="on run argv\nset cmd to \"/bin/bash\"\nrepeat with a in argv\nset cmd to cmd & \" \" & quoted form of (contents of a)\nend repeat\ndo shell script cmd with administrator privileges with prompt \"Fokus needs permission to manage its website blocking helper.\"\nend run";
    let result = Command::new("/usr/bin/osascript")
        .args(["-e", source, "--"])
        .arg(script)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if result.status.success() {
        Ok(())
    } else {
        let msg = String::from_utf8_lossy(&result.stderr);
        Err(if msg.contains("-128") {
            "Setup was cancelled.".into()
        } else {
            format!("macOS could not update the blocker. {msg}")
        })
    }
}
#[tauri::command]
async fn configure_helper(app: tauri::AppHandle, install: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if sandbox().is_some() {
            return Err("Helper setup is disabled in a test workspace.".into());
        }
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let bin = exe.parent().ok_or("Missing app bundle")?;
        let resources = bin.join("../Resources");
        let file = data(&app)?.join("pending.json");
        if install {
            let rules = pending(&app)?;
            write_atomic(&file, &serde_json::to_vec(&rules).unwrap()).map_err(|e| e.to_string())?;
            authorized(
                &resources.join("install-helper.sh"),
                &[
                    &bin.join("fokus-helper"),
                    &file,
                    Path::new(&unsafe { libc::getuid() }.to_string()),
                ],
            )?;
            for _ in 0..40 {
                if let Ok(s) = UnixStream::connect(socket_path()) {
                    if query(s, &json!({"type":"status"}))
                        .is_ok_and(|v| v["version"].as_u64().unwrap_or(0) >= 3)
                    {
                        menubar::refresh(&app);
                        return Ok(());
                    }
                }
                std::thread::sleep(Duration::from_millis(120));
            }
            Err("The helper was installed but has not started. Try reconnecting.".into())
        } else {
            if let Ok(stream) = UnixStream::connect(socket_path()) {
                if let Ok(state) = query(stream, &json!({"type":"status"})) {
                    cache_rules(&app, &state["rules"])?;
                }
            }
            authorized(
                &resources.join("uninstall-helper.sh"),
                &[&bin.join("fokus-helper")],
            )?;
            menubar::refresh(&app);
            Ok(())
        }
    })
    .await
    .map_err(|e| e.to_string())?
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
    Command::new("/usr/bin/open")
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
            "The Mac could not resolve this site. Check your connection or VPN and try again."
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
    use objc2::{AnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage, NSWindow};
    use objc2_foundation::NSData;
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGSMainConnectionID() -> u32;
        fn CGSSetWindowBackgroundBlurRadius(c: u32, w: u32, r: i32) -> i32;
    }
    let theme = match mode.as_str() {
        "dark" => Some(tauri::Theme::Dark),
        "light" => Some(tauri::Theme::Light),
        _ => None,
    };
    window.set_theme(theme).map_err(|e| e.to_string())?;
    if !icon.bytes().all(|c| c.is_ascii_lowercase()) {
        return Err("Unknown finish".into());
    }
    let path = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .with_file_name("../Resources/icons")
        .join(format!("{icon}.png"));
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let target = window.clone();
    window
        .run_on_main_thread(move || {
            if let Some(m) = MainThreadMarker::new() {
                if let Some(img) =
                    NSImage::initWithData(NSImage::alloc(), &NSData::with_bytes(&bytes))
                {
                    unsafe {
                        NSApplication::sharedApplication(m).setApplicationIconImage(Some(&img));
                    }
                }
            }
            if let Ok(ptr) = target.ns_window() {
                unsafe {
                    let n = (&*ptr.cast::<NSWindow>()).windowNumber();
                    CGSSetWindowBackgroundBlurRadius(
                        CGSMainConnectionID(),
                        n as u32,
                        if blur { 30 } else { 0 },
                    );
                }
            }
        })
        .map_err(|e| e.to_string())
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
            .with_file_name("../Resources/themes");
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
        Command::new("/usr/bin/open")
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
    use tauri::menu::{Menu, MenuItem, MenuItemKind};
    if sandbox().is_none() {
        if let Ok(executable) = std::env::current_exe() {
            if let Some(contents) = executable.parent().and_then(Path::parent) {
                let migration = contents.join("Resources/migrate-preview.sh");
                if migration.is_file() {
                    let _ = Command::new("/bin/bash").arg(migration).status();
                }
            }
        }
    }
    tauri::Builder::default()
        .manage(Store(Mutex::new(())))
        .setup(|app| {
            if let Some(main) = objc2::MainThreadMarker::new() {
                if let Err(error) = updater::start(main) {
                    eprintln!("Fokus updater: {error}");
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
        .menu(|app| {
            let menu = Menu::default(app)?;
            if let Some(MenuItemKind::Submenu(sub)) = menu.items()?.first() {
                sub.insert(
                    &MenuItem::with_id(app, "app-update", "Check for Updates…", true, None::<&str>)?,
                    1,
                )?;
                sub.insert(
                    &MenuItem::with_id(app, "settings", "Settings…", true, Some("Cmd+,"))?,
                    3,
                )?;
            }
            Ok(menu)
        })
        .on_menu_event(|app, e| match e.id().as_ref() {
            "app-update" => {
                let _ = app.run_on_main_thread(|| {
                    if let Some(main) = objc2::MainThreadMarker::new() {
                        updater::check(main);
                    }
                });
            }
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
        .run(|app, event| {
            if let tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } = event
            {
                menubar::show(app, "reopen");
            }
        });
}
