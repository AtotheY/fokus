# Fokus for Windows — preview

Extract the whole `Fokus-windows-x64.zip` into a folder and open `Fokus.exe`.
Keep the helper, PowerShell scripts, icons and themes beside the executable.
Requires 64-bit Windows 10/11 and Microsoft Edge WebView2 Runtime.

Choose **Enable blocking** and approve the Windows administrator prompt.
This installs the `FokusBlocker` Windows service, which starts automatically
and maintains only Fokus's marked section in the Windows hosts file. Schedules,
focus sessions, timed exceptions and breaks continue when the window closes or
the tray app quits. The service checks the local clock every second, including
after wake. Administrator access is required for setup and removal.

App protection runs while Fokus is in the system tray. Choose desktop apps from
their Start-menu shortcuts in Groups. When a selected app becomes foreground,
Fokus minimizes its window and offers timed access. It does not terminate apps.
Microsoft Store apps without executable shortcuts and elevated windows may not
be controllable by the normal user app. Quitting Fokus stops app protection.

Closing the window leaves the tray running. Right-click the tray icon to open
Fokus or quit. Use **Ctrl+,** for Settings and **Ctrl+N** to add a website.

Before deleting the folder, use **Settings → Blocker → Uninstall blocker**.
This clears Fokus's hosts entries and removes the service. Saved rules remain
in `C:\ProgramData\Fokus` for reinstalling. Other hosts entries are preserved.
For recovery, run `uninstall-helper.ps1` from an administrator PowerShell.
Setup errors are recorded in `C:\ProgramData\Fokus\setup.log`, and service
startup failures in `service-error.log` in that folder.

The Windows preview uses a native opaque window, manual ZIP upgrades, and UI
fallback icons for apps and custom sites. Comet's Mac tab automation, desktop
background blur and usage counting are unavailable. Cached browser pages,
existing connections and browsers using a remote proxy may bypass hosts
blocking; reopen tabs after changing rules. This is a focus aid, not a security
boundary against a user with administrator access.

## Build from source

Install Node.js 22.13+, stable Rust (MSVC), Visual Studio 2022 C++ Build Tools
including the Windows SDK, and Microsoft Edge WebView2 Runtime.

```powershell
npm ci
cargo check --workspace
cargo test --locked --workspace
npm run build:windows
```

The package is written to `dist/Fokus-windows-x64/` and its ZIP alongside it.
It is an unsigned portable preview. No background service is installed by the
build; installation happens only when Enable blocking is chosen.

To exercise the helper without administrator access or changing system hosts:

```powershell
python tests/windows-helper.py
```

This starts the debug helper in explicit console test mode with a temporary
hosts file, rules and a distinct local pipe, then terminates it and cleans up.
