param([string]$SdkPath = "$env:LOCALAPPDATA\Android\Sdk")
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$aapt = Join-Path $SdkPath 'build-tools\36.0.0\aapt.exe'
$apksigner = Join-Path $SdkPath 'build-tools\36.0.0\apksigner.bat'
$apkPath = Join-Path $projectRoot 'releases\unified\dogdive-order.apk'
$badging = (& $aapt dump badging $apkPath) -join "`n"
if ($LASTEXITCODE -ne 0 -or !$badging.Contains("name='kr.dogdive.roomorder.tablet'")) { throw 'Wrong unified package' }
if (!$badging.Contains("sdkVersion:'33'") -or !$badging.Contains("targetSdkVersion:'33'")) { throw 'Wrong API level' }
if ($badging.Contains('application-debuggable')) { throw 'Debug APK cannot be distributed' }
$manifest = (& $aapt dump xmltree $apkPath AndroidManifest.xml) -join "`n"
if (($manifest | Select-String -Pattern 'screenOrientation.*0x6' -AllMatches).Matches.Count -ne 12) { throw 'Expected 12 landscape activities' }
foreach ($number in @(1,2,3,5,6,7,8,9)) {
    if (!$manifest.Contains(":room$number")) { throw "Missing isolated room process: $number" }
}
if (!$manifest.Contains('kr.dogdive.roomorder.AdminActivity')) { throw 'Missing administrator activity' }
foreach ($component in @('RoomBoundaryActivity','KioskHomeActivity','KioskAdminReceiver','RuntimeSettingsProvider','android.intent.category.HOME','android.permission.BIND_DEVICE_ADMIN')) {
    if (!$manifest.Contains($component)) { throw "Missing kiosk component: $component" }
}
& $apksigner verify $apkPath
if ($LASTEXITCODE -ne 0) { throw 'Invalid APK signature' }
Write-Host 'PASS: unified package, Android 13, landscape, room isolation, release signature'
