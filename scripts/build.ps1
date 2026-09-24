param([string]$SdkPath = "$env:LOCALAPPDATA\Android\Sdk", [string]$GradlePath = '', [switch]$CreateReleaseKey)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
if (!(Test-Path -LiteralPath "$SdkPath\platforms\android-36\android.jar")) { throw 'Android SDK Platform 36 is required.' }
"sdk.dir=$($SdkPath.Replace('\','/').Replace(':','\:'))" | Set-Content -Encoding utf8 local.properties
if (!(Test-Path -LiteralPath signing.properties)) {
    if (Test-Path -LiteralPath tablet-release.jks) { throw 'Restore signing.properties for the existing key. Do not replace the release key.' }
    # Installed tablets accept updates only from the original key; a new key needs a reinstall and loses PIN/settings.
    if (!$CreateReleaseKey) { throw 'Release key not found. Restore tablet-release.jks and signing.properties from backup. Use -CreateReleaseKey only for a first release: tablets signed with the old key cannot be updated.' }
    Write-Warning 'Creating a NEW release key. Back up tablet-release.jks and signing.properties outside this folder.'
    $keyPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
    $env:ROOM_ORDER_KEY_PASSWORD = $keyPassword
    try {
        & keytool -genkeypair -keystore tablet-release.jks -storetype JKS -alias tablet -keyalg RSA -keysize 3072 -validity 10000 -storepass:env ROOM_ORDER_KEY_PASSWORD -keypass:env ROOM_ORDER_KEY_PASSWORD -dname 'CN=Room Order Tablet, O=Local Tablet Apps, C=KR'
        if ($LASTEXITCODE -ne 0) { throw 'Release key generation failed.' }
        @("storeFile=tablet-release.jks", "storePassword=$keyPassword", 'keyAlias=tablet', "keyPassword=$keyPassword") | Set-Content -Encoding ascii signing.properties
    } finally { Remove-Item Env:ROOM_ORDER_KEY_PASSWORD -ErrorAction SilentlyContinue }
}
if ($GradlePath) { $gradleCommand = $GradlePath }
elseif (Test-Path -LiteralPath .\gradlew.bat) { $gradleCommand = '.\gradlew.bat' }
else { throw 'Pass -GradlePath with a Gradle 9.4.1 executable on the first build.' }
& $gradleCommand --no-daemon assembleRelease lintRelease
if ($LASTEXITCODE -ne 0) { throw 'Build or lint failed.' }
New-Item -ItemType Directory -Force -Path releases\unified | Out-Null
$apkPath = 'app\build\outputs\apk\release\app-release.apk'
if (!(Test-Path -LiteralPath $apkPath)) { throw "Missing APK: $apkPath" }
Copy-Item -LiteralPath $apkPath -Destination releases\unified\dogdive-order.apk
Get-FileHash releases\unified\dogdive-order.apk -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  dogdive-order.apk" } | Set-Content releases\unified\SHA256SUMS.txt
Write-Host 'Unified signed APK is ready in releases/unified/.'
