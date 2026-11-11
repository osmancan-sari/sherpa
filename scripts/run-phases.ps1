# Runs the core phases (c0..c5) one after another, each in a fresh Claude Code session.
#
# Usage (from anywhere):
#   powershell -ExecutionPolicy Bypass -File D:\Projects\sherpa\scripts\run-phases.ps1
#   powershell -ExecutionPolicy Bypass -File D:\Projects\sherpa\scripts\run-phases.ps1 -LastPhase c3
#
# It stops when:
#   - every phase up to -LastPhase has its git tag (c0-tamam ... c5-tamam), or
#   - docs/BEKLIYOR.md exists (Claude Code left a question for you), or
#   - a phase is still unfinished after -MaxAttempts sessions.
# Only one copy may run at a time (logs/runner.pid).
#
# When the usage limit is hit, it waits until the limit resets; those sessions do not count as attempts.
# A phase is "done" only when its tag exists. An unfinished phase is continued in a new session.
# After a session sets the tag, this script runs "npm run check:full" itself. If that fails,
# the tag is removed and the next session is told to fix it first.
# This file is ASCII only on purpose: Windows PowerShell 5.1 misreads UTF-8 scripts without a BOM.

param(
  [ValidateSet('c0', 'c1', 'c2', 'c3', 'c4', 'c5')]
  [string]$LastPhase = 'c5',
  [int]$MaxAttempts = 6,
  [int]$RetryWaitMinutes = 45,
  # Model for the sessions. 'opus' uses far less of the usage limit than 'fable'.
  [string]$Model = 'opus'
)

$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Host 'The "claude" command was not found. Install the Claude Code CLI and log in first.'
  exit 3
}

# Logs stay out of git.
New-Item -ItemType Directory -Force logs | Out-Null
if (-not (Test-Path 'logs/.gitignore')) { Set-Content -Path 'logs/.gitignore' -Value '*' -Encoding ascii }

# Only one runner at a time: two runners would start two sessions in the same folder.
$lockFile = 'logs/runner.pid'
if (Test-Path $lockFile) {
  $oldPid = (Get-Content $lockFile -ErrorAction SilentlyContinue | Select-Object -First 1) -as [int]
  if ($oldPid -and $oldPid -ne $PID) {
    $other = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($other -and $other.ProcessName -match 'powershell|pwsh') {
      Write-Host "Another runner seems to be running already (PowerShell PID $oldPid). Stop it first (Ctrl+C in its window)."
      Write-Host 'If you are sure no runner is running, delete logs\runner.pid and start again.'
      exit 4
    }
  }
}
Set-Content -Path $lockFile -Value $PID -Encoding ascii

# Keep the PC awake while this script runs. The effect ends when the script ends.
try {
  Add-Type -Namespace Sherpa -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
  [Sherpa.Power]::SetThreadExecutionState([uint32]2147483649) | Out-Null
} catch {
  Write-Host 'Could not block sleep. Set Windows sleep to "Never" for this run.'
}

# Older Claude Code versions do not know --permission-prompts; the run works without it.
$extraArgs = @()
if ((claude --help 2>&1 | Out-String) -match 'permission-prompts') {
  $extraArgs = @('--permission-prompts', 'none')
} else {
  Write-Host 'This Claude Code version has no --permission-prompts option; running without it. Updating Claude Code is recommended.'
}

$prompt = 'Read prompts/BASLA.md and complete the next phase. This is an unattended run: nobody can answer questions, follow the unattended rules in that file.'
$phases = 'c0', 'c1', 'c2', 'c3', 'c4', 'c5'

function Test-Tag([string]$name) {
  return [bool](git tag --list $name)
}

# If the session log says the usage limit was hit, returns the minutes to wait until it resets. Otherwise 0.
function Get-LimitWaitMinutes([string]$logPath) {
  if (-not (Test-Path $logPath)) { return 0 }
  $text = (Get-Content $logPath -ErrorAction SilentlyContinue | Out-String)
  # The limit message is a single short line; a normal session report is much longer.
  if ($text.Length -gt 1500) { return 0 }
  if ($text -notmatch 'limit') { return 0 }
  if ($text -match 'resets\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)') {
    $hour = [int]$Matches[1] % 12
    if ($Matches[3] -eq 'pm') { $hour += 12 }
    $minute = 0
    if ($Matches[2]) { $minute = [int]$Matches[2] }
    $reset = (Get-Date).Date.AddHours($hour).AddMinutes($minute)
    if ($reset -lt (Get-Date)) { $reset = $reset.AddDays(1) }
    $wait = [int][math]::Ceiling(($reset - (Get-Date)).TotalMinutes) + 3
    if ($wait -gt 330) { $wait = 330 }
    return $wait
  }
  if ($text -match 'usage limit|hit your') { return 30 }
  return 0
}

function Get-Stamp {
  return (Get-Date -Format 'yyyyMMdd-HHmmss')
}

# Outside check: does not rely on what the session reported.
function Test-Gate([string]$gateLog) {
  if (-not (Test-Path 'package.json')) { return $true }
  if (-not (Select-String -Path 'package.json' -Pattern '"check:full"' -Quiet)) {
    Write-Host 'package.json has no check:full script yet; skipping the outside check.'
    return $true
  }
  Write-Host "Running the outside check (npm run check:full). Log: $gateLog"
  npm run check:full 2>&1 | Out-File -FilePath $gateLog
  return ($LASTEXITCODE -eq 0)
}

foreach ($phase in $phases) {
  $tag = "$phase-tamam"
  $attempt = 0
  $limitWaits = 0
  $note = ''

  while ($true) {
    if (Test-Tag $tag) {
      # Phases finished before this run are trusted; phases finished in this run are checked.
      if ($attempt -eq 0) { break }
      $gateLog = "logs/$phase-check-$(Get-Stamp).log"
      if (Test-Gate $gateLog) { break }
      git tag -d $tag | Out-Null
      $note = " The outside check (npm run check:full) failed after $tag was set, so the tag was removed. Read $gateLog and fix that first."
      Write-Host "Outside check failed for $phase. Tag removed; the phase continues."
    }

    if (Test-Path 'docs/BEKLIYOR.md') {
      Write-Host 'Stopped: Claude Code left a question in docs/BEKLIYOR.md.'
      exit 2
    }
    if ($attempt -ge $MaxAttempts) {
      Write-Host "Stopped: $phase is not finished after $MaxAttempts sessions. See docs/ILERLEME.md and the logs folder."
      exit 1
    }

    $attempt++
    $log = "logs/$phase-$(Get-Stamp).log"
    Write-Host "[$(Get-Date -Format 'HH:mm')] $phase, session $attempt, model $Model. Log: $log"

    $started = Get-Date
    claude -p ($prompt + $note) --model $Model --permission-mode auto @extraArgs 2>&1 | Tee-Object -FilePath $log
    $note = ''
    $minutes = ((Get-Date) - $started).TotalMinutes

    if (Test-Tag $tag) { continue }

    # Usage limit: wait for the reset. A session that ended on the limit does not count as an attempt.
    $limitWait = Get-LimitWaitMinutes $log
    if ($limitWait -gt 0) {
      $limitWaits++
      if ($limitWaits -gt 12) {
        Write-Host 'Stopped: the usage limit was hit 12 times in this phase.'
        exit 1
      }
      $attempt--
      Write-Host "[$(Get-Date -Format 'HH:mm')] Usage limit. Waiting $limitWait min for the reset, then continuing."
      Start-Sleep -Seconds ($limitWait * 60)
      continue
    }

    # Any other session that ends within a few minutes without finishing: probably a startup error.
    if ($minutes -lt 5) {
      Write-Host "Session ended after $([int]$minutes) min without finishing the phase. Waiting $RetryWaitMinutes min before the next try."
      Start-Sleep -Seconds ($RetryWaitMinutes * 60)
    }
  }

  Write-Host "[$(Get-Date -Format 'HH:mm')] $phase is done."
  if ($phase -eq $LastPhase) { break }
}

Write-Host 'Finished. Read docs/ILERLEME.md for the reports and the list of things waiting for you.'
