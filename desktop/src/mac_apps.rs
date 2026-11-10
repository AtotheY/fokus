use fokus::MacApp;
use objc2_app_kit::NSWorkspace;
use serde_json::Value;
use std::{collections::BTreeMap, fs, path::Path, process::Command};
use tauri::AppHandle;

fn collect(dir: &Path, apps: &mut BTreeMap<String, MacApp>, depth: u8) {
    let Ok(files) = fs::read_dir(dir) else { return };
    for entry in files.flatten() {
        let path = entry.path();
        if path.extension().and_then(|v| v.to_str()) == Some("app") {
            let Ok(info) = plist::Value::from_file(path.join("Contents/Info.plist")) else {
                continue;
            };
            let Some(info) = info.as_dictionary() else {
                continue;
            };
            let Some(id) = info
                .get("CFBundleIdentifier")
                .and_then(plist::Value::as_string)
            else {
                continue;
            };
            if id == "dev.usefokus.app" || id == "com.apple.finder" {
                continue;
            }
            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            apps.entry(id.into()).or_insert(MacApp {
                id: id.into(),
                name,
            });
        } else if depth > 0 && entry.file_type().is_ok_and(|f| f.is_dir()) {
            collect(&path, apps, depth - 1)
        }
    }
}
#[tauri::command]
pub async fn installed_apps() -> Result<Vec<MacApp>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut apps = BTreeMap::new();
        collect(Path::new("/Applications"), &mut apps, 1);
        collect(Path::new("/System/Applications"), &mut apps, 1);
        if let Some(home) = std::env::var_os("HOME") {
            collect(&Path::new(&home).join("Applications"), &mut apps, 1);
        }
        let mut apps: Vec<_> = apps.into_values().collect();
        apps.sort_by_key(|a| a.name.to_lowercase());
        apps
    })
    .await
    .map_err(|e| e.to_string())
}

pub fn protect(app: &AppHandle, ids: &Value) {
    let Some(ids) = ids.as_array() else { return };
    if ids.is_empty() || crate::sandbox().is_some() {
        return;
    }
    let ids = ids.clone();
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(front) = NSWorkspace::sharedWorkspace().frontmostApplication() else {
            return;
        };
        let Some(id) = front.bundleIdentifier() else {
            return;
        };
        let key = format!("app:{id}");
        if ids.iter().any(|v| v.as_str() == Some(&key)) {
            front.hide();
            crate::menubar::show(&handle, &format!("allow/{key}"));
        }
    });
}

#[tauri::command]
pub fn open_game(url: String) -> Result<(), String> {
    let url = url::Url::parse(&url).map_err(|_| "Enter a complete game URL.")?;
    if !matches!(url.scheme(), "https" | "http")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Choose an http or https game link.".into());
    }
    Command::new("/usr/bin/open")
        .arg(url.as_str())
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
