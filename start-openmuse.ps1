param(
  [switch]$SkipBrowserWorker
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$apiPort = 8787
$webPort = 8081
$workerPort = 8790

function Test-ListeningPort([int]$Port) {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Get-OrCreateWorkerToken {
  $secretsDir = Join-Path $root ".openmuse"
  $tokenPath = Join-Path $secretsDir "browser-worker-token"
  New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null
  if (Test-Path -LiteralPath $tokenPath) {
    return (Get-Content -Raw -LiteralPath $tokenPath).Trim()
  }
  $bytes = [byte[]]::new(48)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $generator.GetBytes($bytes)
  $generator.Dispose()
  $token = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
  Set-Content -NoNewline -LiteralPath $tokenPath -Value $token
  return $token
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm is required. Install Node.js 22+ and pnpm, then run this script again."
}

# Use the real server key from .env when present. A local placeholder is enough
# for the sample app; saved cloud conversations will fall back to local history.
if (-not $env:CPK_INTELLIGENCE_API_KEY) {
  $envLine = if (Test-Path -LiteralPath (Join-Path $root ".env")) {
    Select-String -Path (Join-Path $root ".env") -Pattern '^CPK_INTELLIGENCE_API_KEY=(.+)$' | Select-Object -First 1
  }
  if ($envLine) {
    $env:CPK_INTELLIGENCE_API_KEY = $envLine.Matches[0].Groups[1].Value.Trim().Trim('"').Trim("'")
  } else {
    $env:CPK_INTELLIGENCE_API_KEY = "local-preview-only"
  }
}
$env:EXPO_PUBLIC_API_URL = "http://localhost:$apiPort"

$dockerReady = $false
if (-not $SkipBrowserWorker -and (Get-Command docker -ErrorAction SilentlyContinue)) {
  cmd.exe /d /c "docker info --format '{{.ServerVersion}}' >nul 2>nul"
  $dockerReady = $LASTEXITCODE -eq 0
}

if ($dockerReady) {
  $env:WORKER_TOKEN = Get-OrCreateWorkerToken
  $env:BROWSER_WORKER_URL = "http://127.0.0.1:$workerPort"
  Push-Location $root
  try {
    cmd.exe /d /c "docker compose -f infra/compose.yaml up --build -d browser-worker"
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "The browser worker did not start. The rest of OpenMuse can still run."
      Remove-Item Env:WORKER_TOKEN -ErrorAction SilentlyContinue
      Remove-Item Env:BROWSER_WORKER_URL -ErrorAction SilentlyContinue
    }
  } finally {
    Pop-Location
  }
  if ($LASTEXITCODE -eq 0) {
    cmd.exe /d /c "docker image inspect openmuse-computer:local >nul 2>nul"
    if ($LASTEXITCODE -ne 0) {
      cmd.exe /d /c "docker build -t openmuse-computer:local apps/computer"
    }
    if ($LASTEXITCODE -eq 0) { $env:COMPUTER_ENABLED = "true" }
    else { Write-Warning "The Linux computer image is unavailable. Browser and sample features can still run." }
  }
} elseif (-not $SkipBrowserWorker) {
  Write-Host "Browser worker skipped: start Docker Desktop to enable browser sessions."
}

if (-not (Test-ListeningPort $apiPort)) {
  $apiCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes("pnpm.cmd dev"))
  $powerShellPath = (Get-Command powershell.exe -ErrorAction SilentlyContinue).Source
  if (-not $powerShellPath) { $powerShellPath = (Get-Command pwsh.exe -ErrorAction Stop).Source }
  $logDirectory = Join-Path $root ".openmuse"
  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
  Start-Process -FilePath $powerShellPath `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $apiCommand) `
    -RedirectStandardOutput (Join-Path $logDirectory "api.stdout.log") `
    -RedirectStandardError (Join-Path $logDirectory "api.stderr.log") `
    -WorkingDirectory $root -WindowStyle Minimized
  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Seconds 1
    try {
      $health = Invoke-RestMethod "http://localhost:$apiPort/api/health" -TimeoutSec 2
      if ($health.ok) { $ready = $true; break }
    } catch { }
  }
  if (-not $ready) {
    Get-Content (Join-Path $logDirectory "api.stderr.log") -Tail 20 -ErrorAction SilentlyContinue
    throw "OpenMuse API did not start. Run 'pnpm dev' in this folder to see the error."
  }
} else {
  Write-Host "Using the API already listening on port $apiPort; I did not stop or replace it."
  if ($dockerReady) {
    Write-Warning "The running API was not restarted, so new Docker settings will take effect after you stop that API and run this script again."
  }
}

Write-Host "OpenMuse is ready at http://localhost:$webPort"
Write-Host "Sample mode uses fictional mail and calendar data. Google OAuth and model chat need separate credentials."
if (Test-ListeningPort $webPort) {
  Start-Process "http://localhost:$webPort"
  Write-Host "The web interface is already running."
  exit 0
}
Start-Process "http://localhost:$webPort"
pnpm.cmd --dir apps/mobile web
