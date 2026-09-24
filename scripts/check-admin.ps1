param([int]$Attempts=1,[switch]$Correct)
$ErrorActionPreference='Stop'
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$pin=(Get-Content -Raw captures/qa-pin.txt).Trim()
if (!$Correct) { $pin = if ($pin[0] -eq '9') { '0'+$pin.Substring(1) } else { '9'+$pin.Substring(1) } }
for ($i=0;$i -lt $Attempts;$i++) {
    pwsh -File scripts/device-ui.ps1 -Action dump | Out-Null
    [xml]$tree=Get-Content -Raw captures/current-ui.xml
    $field=$tree.SelectSingleNode('//node[@class="android.widget.EditText"]')
    if (!$field) { throw 'PIN gate is missing' }
    $rect=[regex]::Matches($field.bounds,'\d+') | ForEach-Object { [int]$_.Value }
    & $adb -s emulator-5554 shell input tap ([int](($rect[0]+$rect[2])/2)) ([int](($rect[1]+$rect[3])/2))
    & $adb -s emulator-5554 shell input text $pin
    & $adb -s emulator-5554 shell input keyevent 4
    pwsh -File scripts/device-ui.ps1 -Action tap -Text '설정 열기' | Out-Null
    [xml]$tree=Get-Content -Raw captures/current-ui.xml
    $visible=@($tree.SelectNodes('//node') | Where-Object { $_.text -and $_.password -ne 'true' } | ForEach-Object { $_.text })
    if (!$Correct -and '태블릿이 설치된 방' -in $visible) { throw 'Wrong PIN opened admin' }
    Write-Host "Attempt $($i+1): $($visible -join ' / ')"
}
