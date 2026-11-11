$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if (!$cargo) {
    $cargoPath = Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'
    if (!(Test-Path -LiteralPath $cargoPath)) { throw 'Install stable Rust with rustup first.' }
} else { $cargoPath = $cargo.Source }
& npm.cmd run build:ui
if ($LASTEXITCODE -ne 0) { throw 'Interface build failed.' }
& node scripts/windows-icon.mjs
if ($LASTEXITCODE -ne 0) { throw 'Windows icon generation failed.' }
& $cargoPath build --workspace --locked --release --features custom-protocol
if ($LASTEXITCODE -ne 0) { throw 'Rust build failed. Install Visual Studio C++ Build Tools and Windows SDK.' }
$dest = Join-Path $PWD 'dist\Fokus-windows-x64'
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -LiteralPath 'target\release\fokus.exe' -Destination (Join-Path $dest 'Fokus.exe') -Force
Copy-Item -LiteralPath 'target\release\fokus-helper.exe' -Destination $dest -Force
Copy-Item -LiteralPath 'scripts\install-helper.ps1','scripts\uninstall-helper.ps1','LICENSE','NOTICE.md' -Destination $dest -Force
Copy-Item -LiteralPath 'public\icons','themes','licenses' -Destination $dest -Recurse -Force
Copy-Item -LiteralPath 'docs\WINDOWS.md' -Destination (Join-Path $dest 'README.md') -Force
Compress-Archive -Path (Join-Path $dest '*') -DestinationPath 'dist\Fokus-windows-x64.zip' -Force
Write-Output "Windows package: $dest\Fokus.exe"
