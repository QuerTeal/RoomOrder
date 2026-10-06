param([string]$Repo = '', [string]$NotesFile = '', [switch]$DryRun, [string]$SdkPath = "$env:LOCALAPPDATA\Android\Sdk")
# Publishes releases/unified/dogdive-order.apk as the latest GitHub release with update.json.
# Tablets read https://github.com/<repo>/releases/latest/download/update.json (see roomorder.updateRepo).
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
if (!$Repo) { $Repo = ((Get-Content gradle.properties | Where-Object { $_ -match '^roomorder\.updateRepo=' }) -replace '^roomorder\.updateRepo=', '').Trim() }
if ($Repo -notmatch '^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$') { throw 'Set roomorder.updateRepo=owner/name in gradle.properties or pass -Repo.' }
$apk = 'releases\unified\dogdive-order.apk'
if (!(Test-Path -LiteralPath $apk)) { throw 'Run scripts\build.ps1 first.' }
& (Join-Path $PSScriptRoot 'verify-apks.ps1') -SdkPath $SdkPath
if ($LASTEXITCODE -ne 0) { throw 'APK verification failed' }
$badging = (& (Join-Path $SdkPath 'build-tools\36.0.0\aapt.exe') dump badging $apk) -join "`n"
$code = [int]([regex]::Match($badging, "versionCode='(\d+)'").Groups[1].Value)
$name = [regex]::Match($badging, "versionName='([^']+)'").Groups[1].Value
$built = [regex]::Match((Get-Content -Raw app\build.gradle), 'versionCode (\d+)').Groups[1].Value
if ("$code" -ne $built) { throw "APK versionCode $code does not match app/build.gradle ($built). Rebuild first." }
# The release must have been built with the same repository, or tablets would never find the next update.
if (!(Select-String -LiteralPath app\build\generated\source\buildConfig\release\kr\dogdive\roomorder\BuildConfig.java -SimpleMatch "`"$Repo`"" -Quiet)) { throw "This APK was not built with roomorder.updateRepo=$Repo." }
$tag = "v$name"
$sha = (Get-FileHash $apk -Algorithm SHA256).Hash.ToLower()
$manifest = [ordered]@{ versionCode = $code; versionName = $name; apk = "https://github.com/$Repo/releases/download/$tag/dogdive-order.apk"; sha256 = $sha }
$out = Join-Path $projectRoot 'build\update'; New-Item -ItemType Directory -Force $out | Out-Null
$manifest | ConvertTo-Json | Set-Content -Encoding utf8NoBOM "$out\update.json"
Get-Content "$out\update.json"
if ($DryRun) { "Dry run: not published."; return }
if (!(Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Install GitHub CLI (winget install GitHub.cli) and run gh auth login.' }
$notes = if ($NotesFile) { @('--notes-file', $NotesFile) } else { @('--notes', "테이블 주문 $name") }
& gh release create $tag $apk "$out\update.json" --repo $Repo --title "테이블 주문 $name" --latest @notes
if ($LASTEXITCODE -ne 0) { throw 'GitHub release failed' }
"Published $tag. Tablets install it at 03:00-05:00 while idle."
