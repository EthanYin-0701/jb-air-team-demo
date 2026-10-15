# Build and start PawGroove, then expose it to the internet via a cloudflared
# quick tunnel so it can be opened from a local browser (Windows/PowerShell version).

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not $env:PORT) { $env:PORT = "3000" }
$Port = $env:PORT

$ServerProcess = $null
$TunnelProcess = $null
$TunnelLog = Join-Path ([System.IO.Path]::GetTempPath()) "cloudflared-$PID.log"

function Cleanup {
    Write-Host "Stopping server and tunnel..."
    if ($ServerProcess -and -not $ServerProcess.HasExited) {
        Stop-Process -Id $ServerProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($TunnelProcess -and -not $TunnelProcess.HasExited) {
        Stop-Process -Id $TunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
}

try {
    Write-Host "Building the project..."
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

    Write-Host "Starting the server on 0.0.0.0:$Port..."
    $ServerProcess = Start-Process -FilePath "npx" -ArgumentList "next start -H 0.0.0.0 -p $Port" -PassThru -NoNewWindow

    # Wait for the app to start responding before opening the tunnel.
    Write-Host "Waiting for the app to become ready..."
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                Write-Host "App is up."
                $ready = $true
                break
            }
        } catch {
            # not ready yet
        }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) {
        Write-Host "App did not become ready in time, continuing anyway..."
    }

    # Install cloudflared if it's not already available.
    $cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if (-not $cloudflaredCmd) {
        Write-Host "cloudflared not found, installing..."
        $arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
        $installDir = Join-Path $env:LOCALAPPDATA "cloudflared"
        New-Item -ItemType Directory -Force -Path $installDir | Out-Null
        $cloudflaredExe = Join-Path $installDir "cloudflared.exe"
        $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-$arch.exe"
        Invoke-WebRequest -Uri $downloadUrl -OutFile $cloudflaredExe
        $env:PATH = "$installDir;$env:PATH"
        $cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
        if (-not $cloudflaredCmd) {
            $cloudflaredCmd = @{ Source = $cloudflaredExe }
        }
    }
    $cloudflaredPath = $cloudflaredCmd.Source

    Write-Host "Starting cloudflared tunnel for http://localhost:$Port ..."
    $TunnelProcess = Start-Process -FilePath $cloudflaredPath -ArgumentList "tunnel --url http://localhost:$Port" `
        -RedirectStandardOutput $TunnelLog -RedirectStandardError "$TunnelLog.err" -PassThru -NoNewWindow

    # cloudflared prints the public URL to its log once the tunnel is ready.
    Write-Host "Waiting for the public URL..."
    $publicUrl = $null
    for ($i = 0; $i -lt 60; $i++) {
        foreach ($logFile in @($TunnelLog, "$TunnelLog.err")) {
            if (Test-Path $logFile) {
                $match = Select-String -Path $logFile -Pattern "https://[a-zA-Z0-9.-]*\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($match) {
                    $publicUrl = $match.Matches[0].Value
# Start script for Windows (PowerShell).
# Installs dependencies (if needed), builds the project, and starts the production server.

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")

Set-Location $ProjectRoot

if ([string]::IsNullOrEmpty($env:OPENROUTER_API_KEY)) {
    foreach ($EnvFile in @(".env.local", ".env")) {
        if (Test-Path $EnvFile) {
            $Line = Get-Content $EnvFile | Where-Object { $_ -match '^OPENROUTER_API_KEY=' } | Select-Object -Last 1
            if ($Line) {
                $Value = $Line -replace '^OPENROUTER_API_KEY=', ''
                $Value = $Value.Trim().Trim('"').Trim("'")
                if (-not [string]::IsNullOrEmpty($Value)) {
                    $env:OPENROUTER_API_KEY = $Value
                    Write-Host "Loaded OPENROUTER_API_KEY from $EnvFile."
                    break
                }
            }
        }
        if ($publicUrl) { break }
        Start-Sleep -Seconds 1
    }

    if ($publicUrl) {
        Write-Host ""
        Write-Host "=============================================="
        Write-Host " PawGroove is accessible at: $publicUrl"
        Write-Host "=============================================="
        Write-Host ""
    } else {
        Write-Host "Could not detect the public tunnel URL. Full cloudflared log:"
        if (Test-Path $TunnelLog) { Get-Content $TunnelLog }
        if (Test-Path "$TunnelLog.err") { Get-Content "$TunnelLog.err" }
    }

    # Keep the script running so the server and tunnel stay alive.
    Wait-Process -Id $ServerProcess.Id
}
finally {
    Cleanup
}
