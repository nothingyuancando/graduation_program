param(
  [int]$Port = 5000,
  [switch]$Webpack,
  [switch]$KillPort
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $ProjectRoot

$PidDir = Join-Path $ProjectRoot ".tmp"
$PidFile = Join-Path $PidDir "dev-all-pids.json"

if (!(Test-Path -LiteralPath $PidDir)) {
  New-Item -ItemType Directory -Path $PidDir | Out-Null
}

function Stop-PortProcess {
  param([int]$TargetPort)

  $connections = Get-NetTCPConnection -LocalPort $TargetPort -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" -or $_.State -eq "Established" } |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $connections) {
    if ($processId -and $processId -ne $PID) {
      Write-Host "Stopping process on port $TargetPort, PID $processId"
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Start-ServiceWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  $encodedCommand = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location -LiteralPath '$ProjectRoot'
$Command
Read-Host 'Process exited. Press Enter to close this window'
"@

  return Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $encodedCommand) `
    -WorkingDirectory $ProjectRoot `
    -PassThru
}

if (!(Test-Path -LiteralPath ".env.local")) {
  Write-Warning ".env.local not found. Supabase and LLM credentials may be unavailable."
}

if ($KillPort) {
  Stop-PortProcess -TargetPort $Port
}

$webCommand = if ($Webpack) {
  "npx.cmd next dev --webpack --port $Port"
} else {
  "npx.cmd next dev --turbopack --port $Port"
}

$workerCommand = "pnpm.cmd worker"

Write-Host "Starting web service on http://localhost:$Port"
Write-Host "Starting generation worker"

$web = Start-ServiceWindow -Title "AI Learning Web :$Port" -Command $webCommand
$worker = Start-ServiceWindow -Title "AI Learning Worker" -Command $workerCommand

@{
  startedAt = (Get-Date).ToString("o")
  port = $Port
  webPid = $web.Id
  workerPid = $worker.Id
} | ConvertTo-Json | Set-Content -LiteralPath $PidFile -Encoding UTF8

Write-Host ""
Write-Host "Started:"
Write-Host "  Web    PID: $($web.Id)  URL: http://localhost:$Port"
Write-Host "  Worker PID: $($worker.Id)"
Write-Host ""
Write-Host "Stop them with:"
Write-Host "  pnpm dev:stop"
