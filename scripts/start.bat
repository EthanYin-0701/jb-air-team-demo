@echo off
REM Start script for Windows.
REM Installs dependencies (if needed), builds the project, and starts the production server.

setlocal

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."

cd /d "%PROJECT_ROOT%"

if "%OPENROUTER_API_KEY%"=="" (
    if exist ".env.local" (
        for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /r /c:"OPENROUTER_API_KEY=" ".env.local"`) do set "OPENROUTER_API_KEY=%%B"
    )
)
if "%OPENROUTER_API_KEY%"=="" (
    if exist ".env" (
        for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /r /c:"OPENROUTER_API_KEY=" ".env"`) do set "OPENROUTER_API_KEY=%%B"
    )
)
if not "%OPENROUTER_API_KEY%"=="" (
    echo Loaded OPENROUTER_API_KEY.
) else (
    echo Warning: OPENROUTER_API_KEY is not set ^(checked environment, .env.local, .env^).
)

where npm >nul 2>nul
if errorlevel 1 (
    echo Error: npm is not installed or not available in PATH.
    echo Please install Node.js (https://nodejs.org/) and try again.
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 exit /b 1
)

echo Building the project...
call npm run build
if errorlevel 1 exit /b 1

echo Starting the server...
call npm run start
