use fokus::MacApp;
use serde_json::Value;
use std::os::windows::process::CommandExt;
use std::process::Command;
use windows_sys::Win32::{
    Foundation::CloseHandle,
    System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    },
    UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId, ShowWindowAsync, SW_MINIMIZE,
    },
};

#[tauri::command]
pub async fn installed_apps() -> Result<Vec<MacApp>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        // Start-menu shortcuts identify actual launch targets rather than uninstallers
        // and every incidental executable in Program Files. Microsoft Store apps
        // without a normal executable shortcut are outside this preview's scope.
        let source = r#"$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $shell=New-Object -ComObject WScript.Shell; $roots=@([Environment]::GetFolderPath('CommonStartMenu'),[Environment]::GetFolderPath('StartMenu')); $apps=@(foreach($root in $roots){ Get-ChildItem -LiteralPath $root -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $p=$shell.CreateShortcut($_.FullName).TargetPath; if($p -and $p.EndsWith('.exe',[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $p)){ [pscustomobject]@{id=$p.ToLowerInvariant();name=$_.BaseName} } } }); ConvertTo-Json -InputObject $apps -Compress"#;
        let output = Command::new("powershell.exe").creation_flags(0x08000000).args(["-NoProfile", "-NonInteractive", "-Command", source]).output().map_err(|e| e.to_string())?;
        if !output.status.success() { return Err("Windows could not read the Start menu applications.".into()); }
        let mut apps: Vec<MacApp> = serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())?;
        apps.retain(|a| fokus::blockable_app_id(&a.id));
        apps.sort_by_key(|a| a.id.clone());
        apps.dedup_by(|a,b| a.id == b.id);
        apps.sort_by_key(|a| a.name.to_lowercase());
        Ok(apps)
    }).await.map_err(|e| e.to_string())?
}
pub fn protect(app: &tauri::AppHandle, ids: &Value) {
    if crate::sandbox().is_some() {
        return;
    }
    let Some(ids) = ids.as_array().filter(|v| !v.is_empty()) else {
        return;
    };
    unsafe {
        let window = GetForegroundWindow();
        if window.is_null() {
            return;
        }
        let mut pid = 0;
        GetWindowThreadProcessId(window, &mut pid);
        if pid == std::process::id() {
            return;
        }
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return;
        }
        let mut path = vec![0u16; 32768];
        let mut length = path.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, path.as_mut_ptr(), &mut length);
        CloseHandle(process);
        if ok == 0 {
            return;
        }
        let path = String::from_utf16_lossy(&path[..length as usize]).to_lowercase();
        if !fokus::blockable_app_id(&path) {
            return;
        }
        let key = format!("app:{path}");
        if ids.iter().any(|id| id.as_str() == Some(&key)) {
            ShowWindowAsync(window, SW_MINIMIZE);
            crate::menubar::show(app, &format!("allow/{key}"));
        }
    }
}
#[tauri::command]
pub fn open_game(url: String) -> Result<(), String> {
    let url = url::Url::parse(&url).map_err(|_| "Enter a complete game URL.")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Choose an http or https game link.".into());
    }
    Command::new("explorer.exe")
        .arg(url.as_str())
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
