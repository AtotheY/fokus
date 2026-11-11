// Windows preview does not send usage counts.
#[tauri::command]
pub async fn count_active_day(app: tauri::AppHandle) -> Result<bool, String> {
    let _ = app;
    Ok(true)
}
