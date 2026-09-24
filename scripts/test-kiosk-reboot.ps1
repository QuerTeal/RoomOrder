param(
    [Parameter(Mandatory=$true)][string]$Serial,
    [Parameter(Mandatory=$true)][string]$ExpectForegroundPackage,
    [ValidateSet('LOCKED','NONE')][string]$ExpectLock='NONE',
    [switch]$ExpectHome,
    [string]$SdkPath="$env:LOCALAPPDATA\Android\Sdk"
)
$ErrorActionPreference='Stop'
$adb=Join-Path $SdkPath 'platform-tools\adb.exe'
$before=((& $adb -s $Serial shell cat /proc/sys/kernel/random/boot_id) -join '').Trim()
if ($LASTEXITCODE -ne 0 -or $before -notmatch '^[0-9a-f-]{36}$') { throw 'Cannot read selected device boot ID' }
& $adb -s $Serial reboot
if ($LASTEXITCODE -ne 0) { throw 'Reboot request failed' }
# A still-connected adbd can report the previous boot_completed=1 during shutdown.
# Require a new kernel boot ID before accepting any activity/lock-state result.
$deadline=[DateTime]::UtcNow.AddMinutes(3)
$lastError='Waiting for the new boot'
while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Seconds 2
    $state=((& $adb -s $Serial get-state 2>$null) -join '').Trim()
    if ($LASTEXITCODE -ne 0 -or $state -ne 'device') { continue }
    $after=((& $adb -s $Serial shell cat /proc/sys/kernel/random/boot_id 2>$null) -join '').Trim()
    $completed=((& $adb -s $Serial shell getprop sys.boot_completed 2>$null) -join '').Trim()
    if ($after -eq $before -or $after -notmatch '^[0-9a-f-]{36}$' -or $completed -ne '1') { continue }
    try {
        $result=& (Join-Path $PSScriptRoot 'check-kiosk-device.ps1') -Serial $Serial -ExpectHome:$ExpectHome -ExpectLock $ExpectLock -ExpectForegroundPackage $ExpectForegroundPackage -SdkPath $SdkPath | ConvertFrom-Json
        [pscustomobject]@{PreviousBoot=$before;CurrentBoot=$after;State=$result} | ConvertTo-Json -Depth 5
        exit 0
    } catch { $lastError=$_.Exception.Message }
}
throw "Reboot verification timed out: $lastError"
