param([string]$Source, [string]$Rules, [string]$OwnerSid)
$ErrorActionPreference = 'Stop'
$base = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Fokus'
try {
    Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Management\Microsoft.PowerShell.Management.psd1') -Force
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    if (!(New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator approval is required.' }
    if (Test-Path -LiteralPath $base) {
        if ((Get-Item -LiteralPath $base -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The service folder must not be a link.' }
    }
    $service = Get-Service -Name FokusBlocker -ErrorAction SilentlyContinue
    if ($service) { Stop-Service -Name FokusBlocker -Force; $service.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(15)) }
    $helper = Join-Path $base 'fokus-helper.exe'
    if (Test-Path -LiteralPath $helper) {
        & $helper --clear
        if ($LASTEXITCODE -ne 0) { throw 'Could not clear Fokus hosts entries. The service files were kept for recovery.' }
    }
    if ($service) { & sc.exe delete FokusBlocker | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'Could not remove the service.' } }
    # Keep saved rules for a later reinstall. Remove only the known service binary.
    if (Test-Path -LiteralPath $helper) { Remove-Item -LiteralPath $helper -Force }
    'Blocker removed; saved rules retained.' | Set-Content -LiteralPath (Join-Path $base 'setup.log')
    exit 0
} catch {
    if (Test-Path -LiteralPath $base) { $_.Exception.Message | Set-Content -LiteralPath (Join-Path $base 'setup.log') -ErrorAction SilentlyContinue }
    Write-Error $_
    exit 1
}
