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
    }
}

if ([string]::IsNullOrEmpty($env:OPENROUTER_API_KEY)) {
    Write-Warning "OPENROUTER_API_KEY is not set (checked environment, .env.local, .env)."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not installed or not available in PATH. Please install Node.js (https://nodejs.org/) and try again."
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

Write-Host "Building the project..."
npm run build

Write-Host "Starting the server..."
npm run start
