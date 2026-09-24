param([ValidateSet('dump','tap','back','capture')][string]$Action='dump',[string]$Text='',[string]$Name='current',[string]$Serial='emulator-5554')
$ErrorActionPreference='Stop'
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
function Read-Ui {
    & $adb -s $Serial shell uiautomator dump /sdcard/roomorder-window.xml | Out-Null
    & $adb -s $Serial pull /sdcard/roomorder-window.xml captures/current-ui.xml 2>$null | Out-Null
    return [xml](Get-Content -Raw captures/current-ui.xml)
}
if ($Action -eq 'tap') {
    $tree=Read-Ui
    $nodes=@($tree.SelectNodes('//node') | Where-Object { $_.text -ceq $Text })
    if ($nodes.Count -ne 1) { throw "Expected one visible element: $Text ($($nodes.Count))" }
    $rect=[regex]::Matches($nodes[0].bounds,'\d+') | ForEach-Object { [int]$_.Value }
    & $adb -s $Serial shell input tap ([int](($rect[0]+$rect[2])/2)) ([int](($rect[1]+$rect[3])/2))
}
if ($Action -eq 'back') { & $adb -s $Serial shell input keyevent 4 }
if ($Action -eq 'capture') {
    & $adb -s $Serial shell screencap -p /sdcard/roomorder-screen.png
    & $adb -s $Serial pull /sdcard/roomorder-screen.png "captures/$Name.png" 2>$null
}
$tree=Read-Ui
$tree.SelectNodes('//node') | Where-Object { $_.text -and $_.password -ne 'true' } | ForEach-Object { '{0} {1}' -f $_.bounds,$_.text }
