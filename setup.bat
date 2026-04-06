@echo off
title Household Setup
color 0A

rem ── Work out where this script lives ────────────────────────────────────────
set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%

echo.
echo  ==========================================
echo   Household Management System - Setup
echo  ==========================================
echo.

rem ── Switch to correct branch ────────────────────────────────────────────────
echo  [1/5] Getting latest code...
cd /d "%ROOT%"
git fetch origin >nul 2>&1
git checkout claude/household-google-drive-integration-BFFc3 >nul 2>&1
git pull origin claude/household-google-drive-integration-BFFc3 >nul 2>&1
echo        Done.

rem ── Check Python ────────────────────────────────────────────────────────────
echo  [2/5] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  Python not found. Opening download page...
    echo  Install Python then double-click this file again.
    echo  IMPORTANT: tick Add Python to PATH during install.
    echo.
    start https://python.org/downloads
    pause
    exit
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo        %%v found.

rem ── Verify household folder exists ─────────────────────────────────────────
if not exist "%ROOT%\household\requirements.txt" (
    echo.
    echo  ERROR: household folder not found at %ROOT%\household
    echo  The git checkout may have failed. Check your internet connection
    echo  and double-click setup.bat again.
    echo.
    pause
    exit
)

rem ── Install packages ────────────────────────────────────────────────────────
echo  [3/5] Installing packages...
python -m pip install -r "%ROOT%\household\requirements.txt" --quiet --disable-pip-version-check
echo        flask, anthropic, requests installed.

rem ── Pre-populate database ───────────────────────────────────────────────────
echo  [4/5] Setting up database...
cd /d "%ROOT%\household"
python scanner.py --prepopulate >nul 2>&1
echo        6 household records loaded.

rem ── API Key ──────────────────────────────────────────────────────────────────
echo  [5/5] Anthropic API key...
echo.

if exist "%ROOT%\household\.env" (
    findstr /i "ANTHROPIC_API_KEY=sk-ant-" "%ROOT%\household\.env" >nul 2>&1
    if %errorlevel% equ 0 (
        echo        API key already saved - skipping.
        goto :make_launcher
    )
)

echo  You need a free API key for the Claude AI assistant.
echo  Opening console.anthropic.com now...
echo.
start https://console.anthropic.com/settings/keys
echo.
set /p APIKEY="  Paste your API key here (sk-ant-...): "
if "%APIKEY%"=="" goto :make_launcher
echo ANTHROPIC_API_KEY=%APIKEY%> "%ROOT%\household\.env"
echo OBSIDIAN_VAULT=%ROOT%\obsidian>> "%ROOT%\household\.env"
echo        API key saved.

:make_launcher
rem ── Write start.bat ────────────────────────────────────────────────────────
echo.
echo  Creating start.bat...

(
echo @echo off
echo title Household Dashboard
echo cd /d "%ROOT%\household"
echo if exist .env ^(
echo     for /f "usebackq tokens=1,2 delims==" %%%%a in ^(".env"^) do set "%%%%a=%%%%b"
echo ^)
echo echo.
echo echo  Opening http://localhost:5055
echo echo  Press Ctrl+C to stop.
echo echo.
echo timeout /t 2 /nobreak ^>nul
echo start "" "http://localhost:5055"
echo python dashboard.py
echo pause
) > "%ROOT%\start.bat"

echo        start.bat created.
echo.
echo  ==========================================
echo   All done!
echo  ==========================================
echo.
echo  Dashboard launching now...
echo  FROM NOW ON: just double-click start.bat
echo.

timeout /t 2 /nobreak >nul
start "" "http://localhost:5055"
cd /d "%ROOT%\household"
python dashboard.py

pause
