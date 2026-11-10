# Exercise the shipped release through Windows accessibility APIs. Release
# builds intentionally disable DevTools, so CDP is not a valid launch probe.
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Run only on the temporary Windows CI runner.' }
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Drawing,System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class FokusWindow {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect rect);
}
'@
$folder = Join-Path ([IO.Path]::GetTempPath()) ('fokus-desktop-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $folder | Out-Null
$env:FOKUS_TEST_DIRECTORY = $folder
$env:FOKUS_DISABLE_ACTIVE_COUNT = '1'
$env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $folder 'webview'
$process = $null
try {
    $process = Start-Process -FilePath (Join-Path $PWD 'dist\Fokus-windows-x64\Fokus.exe') -WindowStyle Hidden -PassThru
    for ($n=0; $n -lt 60; $n++) {
        $process.Refresh()
        if ($process.HasExited) { throw "Fokus exited with $($process.ExitCode)." }
        if ($process.MainWindowHandle -ne [IntPtr]::Zero) { break }
        Start-Sleep -Milliseconds 500
    }
    if ($process.MainWindowHandle -eq [IntPtr]::Zero) { throw 'No native Fokus window opened.' }
    $window = $process.MainWindowHandle
    [FokusWindow]::ShowWindowAsync($window,9) | Out-Null
    [FokusWindow]::SetForegroundWindow($window) | Out-Null
    function Names {
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($window)
        $nodes = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
        @($nodes | ForEach-Object { $_.Current.Name })
    }
    $names = @()
    for ($n=0; $n -lt 60; $n++) {
        $names = Names
        if (($names -contains 'Overview') -and ($names -contains 'Groups')) { break }
        Start-Sleep -Milliseconds 500
    }
    if (!(($names -contains 'Overview') -and ($names -contains 'Groups'))) { throw ('React navigation did not render. Accessibility tree: ' + ($names -join ' | ')) }
    if (!($names -contains 'Ctrl+,')) { throw ('Windows shortcut label is missing. Accessibility tree: ' + ($names -join ' | ')) }
    $shell = New-Object -ComObject WScript.Shell
    $shell.AppActivate($process.Id) | Out-Null
    $shell.SendKeys('^,')
    for ($n=0; $n -lt 30; $n++) {
        $names = Names
        if (($names -contains 'Colours') -and ($names -contains 'Privacy')) { break }
        Start-Sleep -Milliseconds 500
    }
    if (!(($names -contains 'Colours') -and ($names -contains 'Privacy'))) { throw ('Ctrl+, did not open Settings. Accessibility tree: ' + ($names -join ' | ')) }
    $rect = New-Object FokusWindow+Rect
    [FokusWindow]::GetWindowRect($window,[ref]$rect) | Out-Null
    $area = [Windows.Forms.Screen]::FromHandle($window).WorkingArea
    if ($rect.Left -lt $area.Left -or $rect.Top -lt $area.Top -or $rect.Right -gt $area.Right -or $rect.Bottom -gt $area.Bottom) { throw 'The startup window overlaps the taskbar or extends beyond the monitor work area.' }
    $bitmap = New-Object Drawing.Bitmap(($rect.Right-$rect.Left),($rect.Bottom-$rect.Top))
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen($rect.Left,$rect.Top,0,0,$bitmap.Size)
        $bitmap.Save((Join-Path $PWD 'dist\windows-desktop-smoke.png'),[Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
    Write-Output 'PASS: shipped Windows release opens, React navigation renders, and Ctrl+, opens Settings.'
} finally {
    if ($process -and !$process.HasExited) { & taskkill.exe /PID $process.Id /T /F | Out-Null }
    $absolute = [IO.Path]::GetFullPath($folder)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if (!$absolute.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Test folder escaped temporary directory.' }
    Start-Sleep -Milliseconds 500
    Remove-Item -LiteralPath $absolute -Recurse -Force
}
