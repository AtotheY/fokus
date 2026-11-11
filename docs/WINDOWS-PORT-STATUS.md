# macOS to Windows port

This document records the Windows desktop port, how its platform pieces fit
together, the features that differ from macOS, and the current verification
status. For setup and recovery instructions, see [Windows instructions](WINDOWS.md).

## Port overview

The Windows version reuses Fokus's Rust rules engine and React interface while
replacing macOS-only app, service, and system integrations with Windows
implementations. macOS entry points remain behind target-specific build
configuration, so both platforms share the same repository.

- **Desktop app:** Tauri native Windows window and tray integration, Windows
  keyboard shortcuts, app selection from Start-menu shortcuts, app icons, and
  foreground-window protection.
- **Website blocker:** A Windows Service named `FokusBlocker` runs independently
  of the app window. It reads saved rules, schedules, focus sessions, timed
  exceptions, and breaks, then maintains Fokus's marked entries in the Windows
  hosts file for IPv4 and IPv6.
- **Setup and permissions:** PowerShell setup and removal scripts request UAC
  elevation. Service files and authoritative rules are stored under
  `C:\ProgramData\Fokus` with restrictive permissions. The helper communicates
  over an owner-restricted named pipe.
- **Windows-specific reliability:** Shared atomic rule-file replacement uses
  Windows replace semantics. Platform-specific app identifiers, process
  handling, icons, and service lifecycle code are implemented in Rust.
- **Packaging:** `npm run build:windows` produces a portable x64 ZIP containing
  the app, helper, setup and removal scripts, icons, themes, notices, and
  instructions. The package is unsigned and updates are manual.

## Website rules and YouTube

The default Social media group includes `youtube.com`. On upgrade, Fokus adds
it once to an existing Social media group while keeping that group's other
sites and enabled setting. YouTube hostname rules include `www.youtube.com`,
`m.youtube.com`, `music.youtube.com`, `youtu.be`, and the privacy-enhanced embed
hosts, including `youtube-nocookie.com`. Custom site entries continue to use the
same shared domain validation and group conflict checks.

The hosts-file approach can be bypassed by cached browser pages, existing
connections, remote proxies, or browser-specific DNS behavior. The code has
unit coverage for YouTube host generation and default-group migration, but a
successful live YouTube block has not been independently confirmed on every
browser configuration. Reopen browser tabs after changing rules; if YouTube
still loads, check browser DNS settings and the active blocker service.

## macOS features not ported

- Comet browser-tab automation and AppleScript protections.
- Sparkle automatic updates; Windows preview updates are manual ZIP downloads.
- Desktop background blur and usage counting.
- Some Microsoft Store apps without Start-menu executable shortcuts and
  elevated windows cannot be controlled by normal-user foreground protection.

Foreground app minimization is implemented, but does not have a dedicated
end-to-end automated test for every Windows app. The hosts-file blocker is a
focus aid, not a security boundary against an administrator.

## Verification and distribution

The Windows preview is built from branch `windows/port`. The implementation
revision verified by CI is `5b584f2` (`Format desktop rules source`). The
corresponding
[Windows GitHub Actions run](https://github.com/Kismat-Adhikari06/fokus/actions/runs/42776615337)
completed successfully with 20 steps passing. CI covers Rust tests and builds,
the helper protocol, chess and puzzle checks, desktop package checks, and
Windows service installation, hosts enforcement, update, and removal.

The portable package is created at `dist/Fokus-windows-x64.zip`; its SHA-256 is
recorded in `dist/Fokus-windows-x64.sha256`. The package currently in this
workspace matches that checksum. No pull request has been created yet.

See [Windows instructions](WINDOWS.md) for requirements, installation, blocker
removal, and local build commands.
