param([Parameter(Mandatory)][string]$Source, [Parameter(Mandatory)][string]$Rules, [Parameter(Mandatory)][string]$OwnerSid)
$ErrorActionPreference = 'Stop'
$base = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Fokus'
try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    if (!(New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator approval is required.' }
    if ($OwnerSid -notmatch '^S-1-[0-9-]+$') { throw 'Invalid owner SID.' }
    $sourcePath = [IO.Path]::GetFullPath($Source)
    $helper = Join-Path $sourcePath 'fokus-helper.exe'
    if (!(Test-Path -LiteralPath $helper -PathType Leaf)) { throw 'The packaged helper is missing.' }
    # Read and validate before touching an installed service.
    $pending = Get-Content -LiteralPath $Rules -Raw
    $null = $pending | ConvertFrom-Json
    if ([Text.Encoding]::UTF8.GetByteCount($pending) -gt 120000) { throw 'Rules file is too large.' }
    if (Test-Path -LiteralPath $base) {
        $item = Get-Item -LiteralPath $base -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The service folder must not be a link.' }
        $ownerFile = Join-Path $base 'owner.sid'
        if ((Test-Path -LiteralPath $ownerFile) -and (Get-Content -LiteralPath $ownerFile -Raw).Trim() -ne $OwnerSid) { throw 'The blocker belongs to another Windows account. Uninstall it from that account first.' }
        # Do not follow files planted as links before first installation.
        if (Get-ChildItem -LiteralPath $base -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'The service folder contains a link.' }
    }
    New-Item -ItemType Directory -Path $base -Force | Out-Null
    # Only SYSTEM and Administrators may change the binary, rules or owner.
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @('S-1-5-18','S-1-5-32-544')) {
        $principal = New-Object Security.Principal.SecurityIdentifier($sid)
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($principal,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
    }
    $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($OwnerSid)),'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow')))
    Set-Acl -LiteralPath $base -AclObject $acl
    # Reset existing files too: changing a directory ACL alone does not remove
    # explicit permissions or ownership left on an older service binary.
    foreach ($item in Get-ChildItem -LiteralPath $base -Force -File) {
        $fileAcl = New-Object Security.AccessControl.FileSecurity
        $fileAcl.SetAccessRuleProtection($true, $false)
        $fileAcl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
        foreach ($sid in @('S-1-5-18','S-1-5-32-544')) {
            $fileAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)),'FullControl','Allow')))
        }
        $fileAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($OwnerSid)),'ReadAndExecute','Allow')))
        Set-Acl -LiteralPath $item.FullName -AclObject $fileAcl
    }
    $existing = Get-Service -Name FokusBlocker -ErrorAction SilentlyContinue
    if ($existing) { Stop-Service -Name FokusBlocker -Force; $existing.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(15)) }
    Copy-Item -LiteralPath $helper -Destination (Join-Path $base 'fokus-helper.exe') -Force
    # Keep authoritative rules on upgrades; pending UI state may be older.
    $state = Join-Path $base 'rules.json'
    if (!(Test-Path -LiteralPath $state)) { [IO.File]::WriteAllText($state,$pending,(New-Object Text.UTF8Encoding($false))) }
    [IO.File]::WriteAllText((Join-Path $base 'owner.sid'),$OwnerSid)
    if (!$existing) {
        New-Service -Name FokusBlocker -DisplayName 'Fokus website blocker' -BinaryPathName ('"' + (Join-Path $base 'fokus-helper.exe') + '"') -StartupType Automatic -Description 'Applies Fokus website rules and timed breaks.' | Out-Null
    }
    & sc.exe failure FokusBlocker reset= 86400 actions= restart/5000/restart/15000/restart/60000 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure service recovery.' }
    & sc.exe failureflag FokusBlocker 1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure service failure handling.' }
    Start-Service -Name FokusBlocker
    'Blocker installed successfully.' | Set-Content -LiteralPath (Join-Path $base 'setup.log')
    exit 0
} catch {
    if (Test-Path -LiteralPath $base) { $_.Exception.Message | Set-Content -LiteralPath (Join-Path $base 'setup.log') -ErrorAction SilentlyContinue }
    Write-Error $_
    exit 1
}
