# Start script for Windows (PowerShell).
# Installs dependencies (if needed), builds the project, and starts the production server.

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")

Set-Location $ProjectRoot

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
