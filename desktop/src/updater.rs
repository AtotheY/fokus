// Sparkle owns the check, signature verification, replacement and relaunch.
// Tauri dispatches both startup and the menu action to the AppKit main thread.
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject};
use objc2::{msg_send, MainThreadMarker};
use objc2_foundation::{NSBundle, NSString};
use std::cell::OnceCell;

thread_local! {
    static CONTROLLER: OnceCell<Retained<AnyObject>> = const { OnceCell::new() };
}

pub fn start(_main: MainThreadMarker) -> Result<(), &'static str> {
    let bundle = NSBundle::mainBundle();
    if bundle
        .objectForInfoDictionaryKey(&NSString::from_str("SUFeedURL"))
        .is_none()
    {
        return Ok(()); // Standalone cargo binaries have no app bundle or update channel.
    }
    let path = std::path::PathBuf::from(bundle.bundlePath().to_string())
        .join("Contents/Frameworks/Sparkle.framework");
    let framework = NSBundle::bundleWithPath(&NSString::from_str(&path.to_string_lossy()))
        .ok_or("bundled Sparkle framework is missing")?;
    if !unsafe { framework.load() } {
        return Err("could not load the bundled Sparkle framework");
    }
    let class = AnyClass::get(c"SPUStandardUpdaterController")
        .ok_or("could not find Sparkle's controller")?;
    let nil: Option<&AnyObject> = None;
    let controller: Retained<AnyObject> = unsafe {
        msg_send![msg_send![class, alloc], initWithUpdaterDelegate: nil, userDriverDelegate: nil]
    };
    CONTROLLER.with(|slot| slot.set(controller).map_err(|_| "Sparkle already started"))
}

pub fn check(_main: MainThreadMarker) {
    CONTROLLER.with(|slot| {
        if let Some(controller) = slot.get() {
            let sender: Option<&AnyObject> = None;
            let _: () = unsafe { msg_send![&**controller, checkForUpdates: sender] };
        } else {
            // A developer build or damaged bundle can still reach the official installer.
            let _ = std::process::Command::new("/usr/bin/open")
                .arg("https://github.com/AtotheY/fokus/releases/latest")
                .spawn();
        }
    });
}
