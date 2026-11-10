// The UI supplies its existing fallback icons when no native thumbnail is returned.
#[tauri::command]
pub async fn app_icon(id: String) -> Option<String> {
    let _ = id;
    None
}
#[tauri::command]
pub async fn site_icon(site: String) -> Option<String> {
    let _ = site;
    None
}
