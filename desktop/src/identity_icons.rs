use objc2::rc::Retained;
use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSWorkspace};
use objc2_foundation::{
    NSData, NSDataBase64EncodingOptions, NSDictionary, NSPoint, NSRect, NSSize, NSString,
};
use std::{fs, path::Path, process::Command};
use tauri::Manager;

fn as_png(bitmap: &NSBitmapImageRep) -> Option<Retained<NSData>> {
    unsafe {
        bitmap.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new())
    }
}

fn data_url(png: &NSData) -> String {
    format!(
        "data:image/png;base64,{}",
        png.base64EncodedStringWithOptions(NSDataBase64EncodingOptions::empty())
    )
}

fn finder_icon(id: &str) -> Option<String> {
    let workspace = NSWorkspace::sharedWorkspace();
    let path = workspace
        .URLForApplicationWithBundleIdentifier(&NSString::from_str(id))?
        .path()?;
    let image = workspace.iconForFile(&path);
    let mut rect = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(48.0, 48.0));
    let selected = unsafe { image.CGImageForProposedRect_context_hints(&mut rect, None, None) }?;
    let bitmap = NSBitmapImageRep::initWithCGImage(objc2::AnyThread::alloc(), &selected);
    Some(data_url(&*as_png(&bitmap)?))
}

#[tauri::command]
pub async fn app_icon(id: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || objc2::rc::autoreleasepool(|_| finder_icon(&id)))
        .await
        .ok()
        .flatten()
}

fn custom_favicon(dir: &Path, host: &str) -> Option<String> {
    let file = dir.join(format!("{host}.png"));
    if let Ok(bytes) = fs::read(&file) {
        let data = NSData::with_bytes(&bytes);
        return Some(data_url(&data));
    }
    // Fetch from the site itself without a browser profile, cookie jar or referrer.
    let output = Command::new("/usr/bin/curl")
        .args([
            "--disable",
            "--fail",
            "--silent",
            "--location",
            "--max-redirs",
            "3",
            "--proto",
            "=https",
            "--proto-redir",
            "=https",
            "--max-time",
            "4",
            "--max-filesize",
            "262144",
            &format!("https://{host}/favicon.ico"),
        ])
        .output()
        .ok()?;
    if !output.status.success() || output.stdout.len() > 262144 {
        return None;
    }
    let data = NSData::with_bytes(&output.stdout);
    let bitmap = NSBitmapImageRep::imageRepWithData(&data)?;
    if bitmap.pixelsWide() > 512 || bitmap.pixelsHigh() > 512 {
        return None;
    }
    let png = as_png(&bitmap)?;
    if png.length() > 524288 {
        return None;
    }
    if fs::create_dir_all(dir).is_ok() {
        let _ = fokus::write_atomic(&file, &png.to_vec());
    }
    Some(data_url(&png))
}

#[tauri::command]
pub async fn site_icon(app: tauri::AppHandle, site: String) -> Option<String> {
    let host = fokus::domain(&site).ok()?;
    let cache = app.path().app_cache_dir().ok()?.join("favicons");
    tauri::async_runtime::spawn_blocking(move || {
        objc2::rc::autoreleasepool(|_| custom_favicon(&cache, &host))
    })
    .await
    .ok()
    .flatten()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn finder_supplies_a_small_png_for_installed_apps() {
        let icon = finder_icon("com.apple.Terminal").expect("macOS Terminal icon");
        assert!(icon.starts_with("data:image/png;base64,iVBORw0KGgo"));
        assert!(icon.len() < 64 * 1024, "oversize thumbnail: {}", icon.len());
        assert!(finder_icon("invalid.fokus.missing-app").is_none());
    }
}
