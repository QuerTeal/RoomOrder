param(
    [Parameter(Mandatory=$true)][string]$Serial,
    [string]$Package = 'kr.dogdive.roomorder.tablet',
    [switch]$ExpectHome,
    [string]$ExpectForegroundPackage = '',
    [ValidateSet('Any','LOCKED','NONE')][string]$ExpectLock = 'Any',
    [string]$SdkPath = "$env:LOCALAPPDATA\Android\Sdk"
)
$ErrorActionPreference = 'Stop'
$adb = Join-Path $SdkPath 'platform-tools\adb.exe'
function Read-Adb([string[]]$Arguments) {
    $result = (& $adb -s $Serial @Arguments 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw $result }
    return $result
}
$sdk = Read-Adb @('shell','getprop','ro.build.version.sdk')
if ([int]$sdk -lt 33) { throw 'Android 13 or later is required' }
$installed = Read-Adb @('shell','dumpsys','package',$Package)
if ($installed -notmatch 'versionName=([^\s]+)') { throw 'App not installed' }
$version = $Matches[1]
$homeApp = Read-Adb @('shell','cmd','package','resolve-activity','--brief','-a','android.intent.action.MAIN','-c','android.intent.category.HOME')
if ($ExpectHome -and !$homeApp.Contains("$Package/kr.dogdive.roomorder.KioskHomeActivity")) { throw 'The selected HOME is not this app' }
$activities = Read-Adb @('shell','dumpsys','activity','activities')
if ($activities -notmatch 'mLockTaskModeState=(\w+)') { throw 'Lock task state unavailable' }
$lock = $Matches[1]
if ($ExpectLock -ne 'Any' -and $lock -ne $ExpectLock) { throw "Expected $ExpectLock, got $lock" }
$top = ($activities -split "`n" | Where-Object { $_ -match 'topResumedActivity=' }) -join "`n"
if ($ExpectForegroundPackage -and $top -notmatch ([regex]::Escape($ExpectForegroundPackage) + '/')) { throw "Unexpected foreground: $top" }
[pscustomobject]@{Serial=$Serial;AndroidApi=$sdk.Trim();Package=$Package;Version=$version;Home=($homeApp -split "`n")[-1];LockTask=$lock;Foreground=$top.Trim()} | ConvertTo-Json
