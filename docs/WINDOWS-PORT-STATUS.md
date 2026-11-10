# Windows port verification

Verified Windows preview: 2026-11-10, source commit `b97c6f9`.

[Passing Windows build and test run](https://github.com/Kismat-Adhikari06/fokus/actions/runs/42761379216)

Passed on the isolated Windows runner:

- Native Rust compilation and 12 Rust tests.
- All eight chess and puzzle tests.
- Real named-pipe helper requests, executable rule IDs and protected app
  rejection, timed app/site exceptions, whole-list breaks, invalid edits,
  persistence, automatic break expiry and exact hosts-file restoration.
- Release ZIP packaging.
- The shipped release opens a native window and renders React navigation.
  The Windows shortcut label is verified and Ctrl+, opens Settings. The window fits the monitor work area without
  overlapping the taskbar; the test captured a screenshot.
- Actual Windows service installation, hosts enforcement, timed breaks,
  reinstall/reconnect preserving authoritative rules, and service removal.

The preview includes a background website blocker, tray controls, desktop app
selection and foreground minimization, schedules, puzzles, UAC setup/removal,
Windows appearance/keyboard adaptations, and portable ZIP packaging.
Foreground minimization is implemented but has not had an automated end-to-end
foreground-window test. Elevated windows and apps without executable Start-menu
shortcuts remain documented limitations. Comet tab automation, automatic Windows
updates, desktop background blur and usage counting are unavailable.

## This PC

Smart App Control is enabled here. Local Rust build programs and a direct launch
of the downloaded executable were both rejected with Windows Application Control
error 4551. The finished preview therefore cannot currently run on this PC.
No Windows security policy was changed. No blocker service was installed and
production hosts were not modified locally.

Running here requires addressing the trust restriction, such as providing a
trusted signed build. The unsigned preview can be used on a Windows development
machine that permits it. See [Windows instructions](WINDOWS.md).

The executable and resources are saved locally in `dist/Fokus-windows-x64/`;
the distributable ZIP is `dist/Fokus-windows-x64.zip`. GitHub Actions also retains
ZIP and desktop screenshot artifacts on the passing run above.
