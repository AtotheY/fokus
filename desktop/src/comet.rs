use crate::{menubar, query, sandbox, socket_path};
use fokus::hostnames;
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader},
    os::unix::net::UnixStream,
    path::Path,
    process::{Command, Stdio},
    sync::Mutex,
    time::Duration,
};
use tauri::{AppHandle, Manager};

pub struct Status(Mutex<String>);

fn update(app: &AppHandle, value: &str) {
    *app.state::<Status>().0.lock().unwrap() = value.to_owned();
}

#[tauri::command]
pub fn comet_status(app: AppHandle) -> Value {
    json!({"available":Path::new("/Applications/Comet.app").exists(), "state":*app.state::<Status>().0.lock().unwrap()})
}

#[tauri::command]
pub fn open_automation_settings() -> Result<(), String> {
    Command::new("/usr/bin/open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Automation")
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn open_break(app: &AppHandle, host: &str) {
    let Ok(stream) = UnixStream::connect(socket_path()) else {
        return;
    };
    let Ok(state) = query(stream, &json!({"type":"status"})) else {
        return;
    };
    let Some(sites) = state["blocked"].as_array() else {
        return;
    };
    for site in sites.iter().filter_map(Value::as_str) {
        if hostnames(&[site.to_owned()]).contains(host) {
            menubar::show(app, &format!("allow/{site}"));
            return;
        }
    }
}

pub fn install(app: &AppHandle) {
    app.manage(Status(Mutex::new("waiting".into())));
    if sandbox().is_some() || !Path::new("/Applications/Comet.app").exists() {
        return;
    }
    let Ok(bin) = std::env::current_exe() else {
        return;
    };
    let Some(resources) = bin
        .parent()
        .and_then(Path::parent)
        .map(|p| p.join("Resources"))
    else {
        return;
    };
    let app = app.clone();
    std::thread::spawn(move || loop {
        let spawn = Command::new("/usr/bin/osascript")
            .args(["-l", "JavaScript"])
            .arg(resources.join("watch-comet.js"))
            .arg(resources.join("Comet/blocked.html"))
            .arg("/private/etc/hosts")
            .arg(std::process::id().to_string())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .spawn();
        if let Ok(mut child) = spawn {
            if let Some(pipe) = child.stdout.take() {
                for line in BufReader::new(pipe).lines().map_while(Result::ok) {
                    if let Ok(event) = serde_json::from_str::<Value>(&line) {
                        if let Some(status) = event["status"].as_str() {
                            update(&app, status);
                        }
                        if let Some(host) = event["allow"].as_str() {
                            open_break(&app, host);
                        }
                    }
                }
            }
            let _ = child.wait();
        }
        update(&app, "retrying");
        std::thread::sleep(Duration::from_secs(5));
    });
}
