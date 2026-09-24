$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
New-Item -ItemType Directory -Force -Path build\checks | Out-Null
& javac -encoding UTF-8 -d build\checks app\src\main\java\kr\dogdive\roomorder\PinCredentials.java scripts\tests\PinCredentialsTest.java
if ($LASTEXITCODE -ne 0) { throw 'PIN test compilation failed' }
& java -cp build\checks PinCredentialsTest
if ($LASTEXITCODE -ne 0) { throw 'PIN tests failed' }
& javac -encoding UTF-8 -d build\checks app\src\main\java\kr\dogdive\roomorder\SessionRecovery.java scripts\tests\SessionRecoveryTest.java
if ($LASTEXITCODE -ne 0) { throw 'Session recovery test compilation failed' }
& java -cp build\checks kr.dogdive.roomorder.SessionRecoveryTest
if ($LASTEXITCODE -ne 0) { throw 'Session recovery tests failed' }
& javac -encoding UTF-8 -d build\checks app\src\main\java\kr\dogdive\roomorder\CrashRecovery.java scripts\tests\CrashRecoveryTest.java
if ($LASTEXITCODE -ne 0) { throw 'Crash recovery test compilation failed' }
& java -cp build\checks kr.dogdive.roomorder.CrashRecoveryTest
if ($LASTEXITCODE -ne 0) { throw 'Crash recovery tests failed' }
& node --check app\src\main\assets\tablet.js
if ($LASTEXITCODE -ne 0) { throw 'JavaScript syntax check failed' }
& node --check app\src\main\assets\theme.js
if ($LASTEXITCODE -ne 0) { throw 'Theme JavaScript syntax check failed' }
& node --check app\src\main\assets\interaction.js
if ($LASTEXITCODE -ne 0) { throw 'Interaction JavaScript syntax check failed' }
& node scripts\tests\interaction.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Interaction tests failed' }
& node --check app\src\main\assets\session-state.js
if ($LASTEXITCODE -ne 0) { throw 'Session JavaScript syntax check failed' }
& javac -encoding UTF-8 -d build\checks app\src\main\java\kr\dogdive\roomorder\IdleRefresh.java scripts\tests\IdleRefreshTest.java
if ($LASTEXITCODE -ne 0) { throw 'Idle refresh test compilation failed' }
& java -cp build\checks kr.dogdive.roomorder.IdleRefreshTest
if ($LASTEXITCODE -ne 0) { throw 'Idle refresh tests failed' }
& node --check app\src\main\assets\cart-maintenance.js
if ($LASTEXITCODE -ne 0) { throw 'Cart maintenance syntax check failed' }
[xml]$manifest = Get-Content -Raw app\src\main\AndroidManifest.xml
$ns = [Xml.XmlNamespaceManager]::new($manifest.NameTable)
$ns.AddNamespace('android','http://schemas.android.com/apk/res/android')
$public = $manifest.SelectNodes('//activity[@android:exported="true"]',$ns)
$publicNames = @($public | ForEach-Object { $_.GetAttribute('name',$ns.LookupNamespace('android')) } | Sort-Object)
if (($publicNames -join ',') -ne '.KioskHomeActivity,.RoomPickerActivity') { throw 'Unexpected public activity' }
$provider = $manifest.SelectSingleNode('//provider[@android:name=".RuntimeSettingsProvider"]',$ns)
if (!$provider -or $provider.GetAttribute('exported',$ns.LookupNamespace('android')) -ne 'false') { throw 'Runtime settings must be private' }
$admin = $manifest.SelectSingleNode('//receiver[@android:name=".KioskAdminReceiver"]',$ns)
if (!$admin -or $admin.GetAttribute('permission',$ns.LookupNamespace('android')) -ne 'android.permission.BIND_DEVICE_ADMIN') { throw 'Device admin must require the system permission' }
$rooms = $manifest.SelectNodes('//activity[starts-with(@android:name,".Rooms$")]',$ns)
if ($rooms.Count -ne 8) { throw 'Room profile count mismatch' }
$processes = @($rooms | ForEach-Object { $_.GetAttribute('process',$ns.LookupNamespace('android')) } | Select-Object -Unique)
if ($processes.Count -ne 8) { throw 'Room profiles must use independent processes' }
[xml]$strings = Get-Content -Raw app\src\main\res\values\strings.xml
$names = @($strings.resources.string | ForEach-Object { $_.name })
Get-ChildItem app\src\main\java -Recurse -Filter *.java | ForEach-Object {
    $code = Get-Content -Raw -LiteralPath $_.FullName
    if ($code -match '[가-힣]') { throw "Move UI text into resources: $($_.Name)" }
    foreach ($match in [regex]::Matches($code,'R\.string\.(\w+)')) {
        if ($match.Groups[1].Value -notin $names) { throw "Missing string: $($match.Value)" }
    }
}
[xml]$links = Get-Content -Raw app\src\main\res\values\rooms.xml
$urls = @($links.resources.'string-array'.item)
if ($urls.Count -ne 8 -or @($urls | Select-Object -Unique).Count -ne 8) { throw 'Expected eight unique room links' }
Write-Host 'PASS: resources, room links, private admin and independent room processes'
