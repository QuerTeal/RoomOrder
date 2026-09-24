param([string]$Tool = '', [string]$ArgumentsJson = '{}')
$ErrorActionPreference = 'Stop'
$endpoint = 'http://127.0.0.1:64342/stream'
$headers = @{Accept='application/json, text/event-stream'}
function Invoke-Mcp($payload) {
    $response = Invoke-WebRequest -Uri $endpoint -Method Post -ContentType 'application/json' -Headers $headers -Body ($payload | ConvertTo-Json -Depth 30 -Compress) -TimeoutSec 180
    if ($response.Headers['mcp-session-id']) { $headers['Mcp-Session-Id'] = $response.Headers['mcp-session-id'][0] }
    if (!$response.Content) { return $null }
    $raw = [string]$response.Content
    if ($raw.StartsWith('event:') -or $raw.StartsWith('data:')) {
        $raw = (($raw -split "`n" | Where-Object { $_.StartsWith('data:') }) -replace '^data:\s*','') -join "`n"
    }
    $result = $raw | ConvertFrom-Json
    if ($result.error) { throw ($result.error | ConvertTo-Json -Compress) }
    return $result.result
}
$null = Invoke-Mcp @{jsonrpc='2.0';id=1;method='initialize';params=@{protocolVersion='2025-03-26';capabilities=@{};clientInfo=@{name='codex-roomorder-dev';version='1.0'}}}
$headers['MCP-Protocol-Version'] = '2025-03-26'
$null = Invoke-Mcp @{jsonrpc='2.0';method='notifications/initialized'}
try {
    if (!$Tool) { Invoke-Mcp @{jsonrpc='2.0';id=2;method='tools/list';params=@{}} | ConvertTo-Json -Depth 30 }
    else { Invoke-Mcp @{jsonrpc='2.0';id=2;method='tools/call';params=@{name=$Tool;arguments=($ArgumentsJson | ConvertFrom-Json -AsHashtable)}} | ConvertTo-Json -Depth 30 }
} finally {
    try { $null = Invoke-WebRequest -Uri $endpoint -Method Delete -Headers $headers -TimeoutSec 5 } catch { }
}
