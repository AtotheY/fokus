# Windows port verification

Implementation includes a Windows-service hosts blocker, owner-restricted local
named-pipe protocol, desktop executable selection and foreground minimization,
shared focus rules and puzzles, tray integration, UAC setup/removal scripts,
Windows appearance/keyboard adaptations, and portable ZIP packaging.

Verified locally on 2026-11-10:

- `npm ci`: successful, audit reported zero vulnerabilities.
- `npm run build:ui`: successful.
- `node --test tests/chess.mjs tests/puzzles.mjs`: eight tests passed.
- Windows PowerShell setup, removal and packaging scripts parse successfully.
- Rust formatting parses the new Windows source files successfully.
- The Windows Start-menu scanner ran successfully and returned 77 executable
  shortcuts with valid JSON records.
- Installer permission-rule constructors were exercised in memory successfully.

Native compilation is currently blocked by this PC's enforced Windows Smart
App Control policy (state 1). Cargo cannot execute generated dependency build
scripts, returning Windows error 4551. Code Integrity events 3033 and 3077
identify the blocked executables and policy
`{0283AC0F-FFF1-49AE-ADA1-8A933130CAD6}`. No security policy was changed.

Until a native build succeeds, the Windows implementation is unvalidated and
there is no completed Windows executable or ZIP. Required remaining checks:

1. `cargo check --workspace` and `cargo test --locked --workspace`.
2. `cargo build --locked --workspace` and `python tests/windows-helper.py`.
3. `npm run build:windows` and a native desktop launch check.
4. Administrator service setup/removal and foreground app protection checks
   on a development/test Windows machine.

The Windows workflow runs the compilation, rules tests, disposable-hosts helper
tests, puzzle tests and release packaging, and uploads the ZIP as a build
artifact. Production hosts and installed services have not been modified by
the local checks.
