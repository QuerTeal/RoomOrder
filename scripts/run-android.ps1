param([Parameter(Mandatory=$true)][string]$Serial, [switch]$BuildRelease, [switch]$InstallRelease, [string]$SdkPath="$env:LOCALAPPDATA\Android\Sdk")
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$adb=Join-Path $SdkPath 'platform-tools\adb.exe'
$deviceState=& $adb -s $Serial get-state
if ($LASTEXITCODE -ne 0 -or $deviceState.Trim() -ne 'device') { throw 'Selected Android device is unavailable' }
$tasks=@('assembleDebug')
if ($BuildRelease -or $InstallRelease) { $tasks+=@('assembleRelease','lintRelease') }
& .\gradlew.bat --no-daemon @tasks
if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
$apkPath=if ($InstallRelease) { 'app\build\outputs\apk\release\app-release.apk' } else { 'app\build\outputs\apk\debug\app-debug.apk' }
$packageName=if ($InstallRelease) { 'kr.dogdive.roomorder.tablet' } else { 'kr.dogdive.roomorder.dev' }
& $adb -s $Serial install -r $apkPath
if ($LASTEXITCODE -ne 0) { throw 'APK installation failed' }
& $adb -s $Serial shell am start -W -n "$packageName/kr.dogdive.roomorder.RoomPickerActivity"
if ($LASTEXITCODE -ne 0) { throw 'App launch failed' }
