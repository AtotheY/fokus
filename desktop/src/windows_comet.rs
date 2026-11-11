#[tauri::command]
pub fn comet_status() -> serde_json::Value {
    serde_json::json!({"available":false,"state":"unsupported"})
}
#[tauri::command]
pub fn open_automation_settings() -> Result<(), String> {
    Err("Comet tab automation is currently available only on macOS. Website blocking still works on Windows.".into())
}
pub fn install(_: &tauri::AppHandle) {}
