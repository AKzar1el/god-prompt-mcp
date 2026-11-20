# Read-only, zero-API-cost monitoring of the existing local Codexify service.
# This intentionally never restarts a service, mutates an MCP, or reads its data.
[CmdletBinding()]
param(
    [ValidateSet('Check', 'SelfTest')]
    [string] $Mode = 'Check',
    [string] $StateDirectory = '',
    [switch] $NotifyOnChange
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Snapshot of the 18 upstreams connected after the 2026-11-20 recovery.
# An intentionally retired source should be removed here after review.
$ExpectedSources = @(
    'chrome-devtools', 'cloudflare-api', 'context7', 'filesystem',
    'firecrawl', 'github', 'god-prompt-mcp', 'kinocut', 'kokoro-tts',
    'mcp-gsc', 'mcp-trendpulse', 'mcp-web-validator', 'memory', 'n',
    'playwright', 'playwright-extension', 'revenue_shot_preflight',
    'shared-browser'
)

function Get-Field([object] $Object, [string] $Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Test-HealthDocument([object] $Health, [string[]] $Sources) {
    $issues = New-Object System.Collections.Generic.List[string]
    $status = Get-Field $Health 'status'
    $upstreams = Get-Field $Health 'upstreams'
    if ($status -ne 'ok') { $issues.Add('Codexify health status is not ok') }
    if ($null -eq $upstreams) {
        $issues.Add('Codexify health response has no upstream status map')
    } else {
        foreach ($name in $Sources) {
            $source = Get-Field $upstreams $name
            if ($null -eq $source) {
                $issues.Add("Missing upstream: $name")
            } elseif ((Get-Field $source 'state') -ne 'connected') {
                $issues.Add("Disconnected upstream: $name")
            }
        }
    }
    return [pscustomobject]@{
        healthy = ($issues.Count -eq 0)
        issues = @($issues.ToArray())
        monitoredSources = $Sources.Count
    }
}

function New-MonitorState([object] $Previous, [object] $Assessment, [string] $Now) {
    $oldFailures = Get-Field $Previous 'consecutiveFailures'
    $oldAlert = Get-Field $Previous 'alertActive'
    $oldHealthy = Get-Field $Previous 'healthy'
    $oldHistory = @(Get-Field $Previous 'history')
    $history = @($oldHistory | Where-Object { $null -ne $_ })
    $failures = if ($Assessment.healthy) { 0 } else { [int]$oldFailures + 1 }
    $alertActive = (-not $Assessment.healthy) -and (($failures -ge 2) -or ($oldAlert -eq $true))
    $notify = ($alertActive -and ($oldAlert -ne $true)) -or
              ($Assessment.healthy -and ($oldAlert -eq $true))
    $transition = if ($null -eq $Previous) {
        'initial'
    } elseif ($oldHealthy -ne $Assessment.healthy) {
        if ($Assessment.healthy) { 'recovered' } else { 'degraded' }
    } elseif ($alertActive -and ($oldAlert -ne $true)) {
        'alert_threshold_reached'
    } else { '' }
    if ($transition) {
        $history += [pscustomobject]@{
            atUtc = $Now
            event = $transition
            issues = @($Assessment.issues)
        }
    }
    $history = @($history | Select-Object -Last 64)
    return [pscustomobject]@{
        schemaVersion = 1
        checkedAtUtc = $Now
        healthy = [bool]$Assessment.healthy
        monitoredSources = [int]$Assessment.monitoredSources
        issues = @($Assessment.issues)
        consecutiveFailures = [int]$failures
        alertActive = [bool]$alertActive
        notify = [bool]$notify
        history = $history
    }
}

function Assert-True([bool] $Condition, [string] $Description) {
    if (-not $Condition) { throw "Self-test failed: $Description" }
}

if ($Mode -eq 'SelfTest') {
    $mockSources = [pscustomobject]@{
        'god-prompt-mcp' = [pscustomobject]@{ state = 'connected' }
        memory = [pscustomobject]@{ state = 'connected' }
    }
    $expected = @('god-prompt-mcp', 'memory')
    $up = [pscustomobject]@{ status = 'ok'; upstreams = $mockSources }
    $good = Test-HealthDocument $up $expected
    Assert-True $good.healthy 'healthy source map'
    $first = New-MonitorState $null $good '2026-11-20T00:00:00Z'
    Assert-True ($first.consecutiveFailures -eq 0 -and -not $first.notify) 'initial state'
    $bad = Test-HealthDocument ([pscustomobject]@{
        status = 'ok'
        upstreams = [pscustomobject]@{
            'god-prompt-mcp' = [pscustomobject]@{ state = 'failed' }
        }
    }) $expected
    Assert-True (-not $bad.healthy -and $bad.issues.Count -eq 2) 'disconnected and missing sources'
    $second = New-MonitorState $first $bad '2026-11-20T00:15:00Z'
    Assert-True ($second.consecutiveFailures -eq 1 -and -not $second.notify) 'one miss causes no alert'
    $third = New-MonitorState $second $bad '2026-11-20T00:30:00Z'
    Assert-True ($third.consecutiveFailures -eq 2 -and $third.notify -and $third.alertActive) 'two misses trigger alert'
    $fourth = New-MonitorState $third $bad '2026-11-20T00:45:00Z'
    Assert-True (-not $fourth.notify -and $fourth.consecutiveFailures -eq 3) 'alert deduplication'
    $fifth = New-MonitorState $fourth $good '2026-11-20T01:00:00Z'
    Assert-True ($fifth.healthy -and $fifth.notify -and -not $fifth.alertActive -and $fifth.consecutiveFailures -eq 0) 'recovery notification'
    $malformed = Test-HealthDocument $null $expected
    Assert-True (-not $malformed.healthy) 'null health fails closed'
    $history = $fifth
    for ($i = 1; $i -le 90; $i++) {
        $history = New-MonitorState $history $bad ('2026-11-20T01:00:{0:00}Z' -f ($i % 60))
        $history.healthy = $true
    }
    Assert-True ($history.history.Count -le 64) 'bounded history'
    $testDir = Join-Path $env:TEMP ('godprompt-monitor-selftest-' + [Guid]::NewGuid().ToString('N'))
    $null = New-Item -Path $testDir -ItemType Directory -ErrorAction Stop
    try {
        $original = Join-Path $testDir 'latest.json'
        $replacement = Join-Path $testDir 'latest.tmp'
        $backup = Join-Path $testDir 'previous.json'
        [IO.File]::WriteAllText($original, 'old')
        [IO.File]::WriteAllText($replacement, 'new')
        [IO.File]::Replace($replacement, $original, $backup)
        Assert-True (([IO.File]::ReadAllText($original)) -eq 'new') 'atomic replacement'
        Assert-True (([IO.File]::ReadAllText($backup)) -eq 'old') 'previous-state backup'
    } finally {
        $absolute = [IO.Path]::GetFullPath($testDir)
        $temporaryRoot = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
        if ($absolute.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -and
            ([IO.Path]::GetFileName($absolute)) -match '^godprompt-monitor-selftest-[a-f0-9]{32}$') {
            Remove-Item -LiteralPath $absolute -Recurse -Force
        }
    }
    Write-Output 'PASS: healthy, missing, disconnected, alert threshold, dedup, recovery, malformed, bounded history, atomic replacement, backup'
    exit 0
}

$time = [DateTime]::UtcNow.ToString('o')
if (-not $StateDirectory) {
    $StateDirectory = Join-Path $env:USERPROFILE '.codexify\health-monitor'
}
$stateFile = Join-Path $StateDirectory 'latest.json'
$previous = $null
if (Test-Path -LiteralPath $stateFile -PathType Leaf) {
    try {
        $previous = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    } catch {
        # Keep original bytes in a dated backup rather than losing state.
        $backup = Join-Path $StateDirectory ('corrupt-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss') + '.json')
        Copy-Item -LiteralPath $stateFile -Destination $backup -ErrorAction Stop
    }
}

try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 8 -ErrorAction Stop
    $assessment = Test-HealthDocument $health $ExpectedSources
} catch {
    $assessment = [pscustomobject]@{
        healthy = $false
        issues = @('Codexify local health endpoint is unreachable or invalid')
        monitoredSources = $ExpectedSources.Count
    }
}
$newState = New-MonitorState $previous $assessment $time
if (-not (Test-Path -LiteralPath $StateDirectory -PathType Container)) {
    $null = New-Item -ItemType Directory -Path $StateDirectory -Force
}
$temporaryFile = Join-Path $StateDirectory ('latest.' + $PID + '.tmp')
$encoded = $newState | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText($temporaryFile, $encoded, (New-Object Text.UTF8Encoding($false)))
try {
    if (Test-Path -LiteralPath $stateFile) {
        # On Windows/.NET Framework, File.Replace rejects a null backup
        # pathname. Keep one previous snapshot for rollback instead.
        $previousFile = Join-Path $StateDirectory 'previous.json'
        [IO.File]::Replace($temporaryFile, $stateFile, $previousFile)
    } else {
        [IO.File]::Move($temporaryFile, $stateFile)
    }
} finally {
    if (Test-Path -LiteralPath $temporaryFile) { Remove-Item -LiteralPath $temporaryFile -Force }
}

if ($NotifyOnChange -and $newState.notify) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $notice = New-Object System.Windows.Forms.NotifyIcon
        try {
            $notice.Icon = [System.Drawing.SystemIcons]::Warning
            $notice.Visible = $true
            $notice.BalloonTipTitle = 'Codexify MCP health'
            $notice.BalloonTipText = if ($newState.healthy) { 'Recovered: monitored MCP servers are connected.' } else {
                'MCP health check failed twice; inspect .codexify\health-monitor\latest.json.'
            }
            $notice.ShowBalloonTip(6000)
            Start-Sleep -Seconds 6
        } finally {
            $notice.Dispose()
        }
    } catch {
        # Notification is best-effort; the persisted health result is authoritative.
    }
}
Write-Output $encoded
if (-not $newState.healthy) { exit 1 }
exit 0
