$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$PidFile = Join-Path $ProjectRoot ".tmp\dev-all-pids.json"

function Stop-RecordedProcess {
  param(
    [string]$Name,
    [object]$ProcessId
  )

  if (!$ProcessId) {
    return
  }

  $process = Get-Process -Id ([int]$ProcessId) -ErrorAction SilentlyContinue
  if (!$process) {
    Write-Host "$Name PID $ProcessId is not running."
    return
  }

  Write-Host "Stopping $Name PID $ProcessId"
  Stop-Process -Id ([int]$ProcessId) -Force -ErrorAction SilentlyContinue
}

if (!(Test-Path -LiteralPath $PidFile)) {
  Write-Host "No recorded dev processes found."
  Write-Host "If port 5000 is still busy, run:"
  Write-Host "  Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess"
  exit 0
}

$record = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json

Stop-RecordedProcess -Name "web" -ProcessId $record.webPid
Stop-RecordedProcess -Name "worker" -ProcessId $record.workerPid

Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
Write-Host "Stopped recorded dev processes."
