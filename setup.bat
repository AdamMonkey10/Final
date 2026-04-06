@echo off
cd /d "%~dp0"
title Household Setup
color 0A

echo.
echo  ==========================================
echo   Household Management System - Setup
echo  ==========================================
echo.

rem ── Switch to the correct branch ─────────────────────────────────────────
echo  [1/5] Getting latest code...
git fetch origin >nul 2>&1
git checkout claude/household-google-drive-integration-BFFc3 >nul 2>&1
git pull origin claude/household-google-drive-integration-BFFc3 >nul 2>&1
echo        Done.

rem ── Check Python ─────────────────────────────────────────────────────────
echo  [2/5] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  Python not found. Opening download page...
    echo  Install Python then double-click this file again.
    echo  IMPORTANT: tick "Add Python to PATH" during install.
    echo.
    start https://python.org/downloads
    pause
    exit
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo        %%v found.

rem ── Install packages ──────────────────────────────────────────────────────
echo  [3/5] Installing packages...
cd household
python -m pip install -r requirements.txt --quiet --disable-pip-version-check
echo        flask, anthropic, requests installed.

rem ── Pre-populate database ─────────────────────────────────────────────────
echo  [4/5] Setting up database...
python -c "import sqlite3; c=sqlite3.connect('household.db'); c.execute('SELECT name FROM sqlite_master WHERE type=chr(39)+chr(116)+chr(97)+chr(98)+chr(108)+chr(101)+')" >nul 2>&1
python scanner.py --prepopulate >nul 2>&1
echo        6 household records loaded.

rem ── API Key ───────────────────────────────────────────────────────────────
echo  [5/5] Anthropic API key...
echo.

if exist .env (
    findstr /i "ANTHROPIC_API_KEY=sk-ant-" .env >nul 2>&1
    if %errorlevel% equ 0 (
        echo        API key found in .env - skipping.
        goto :launch
    )
)

echo  You need a free API key for the Claude AI assistant.
echo  Opening console.anthropic.com now...
echo.
start https://console.anthropic.com/settings/keys
echo.
set /p APIKEY="  Paste your API key here (sk-ant-...): "

if "%APIKEY%"=="" goto :launch
echo ANTHROPIC_API_KEY=%APIKEY%> .env
echo OBSIDIAN_VAULT=C:\Users\user\Projects\claude\home-automation\obsidian>> .env
echo        API key saved.

:launch
rem ── Create start.bat ──────────────────────────────────────────────────────
echo.
echo  Creating start.bat shortcut...

(
echo @echo off
echo cd /d "%~dp0"
echo title Household Dashboard
echo if exist .env ^(
echo     for /f "usebackq tokens=1,2 delims==" %%%%a in ^(".env"^) do set "%%%%a=%%%%b"
echo ^)
echo echo.
echo echo  Dashboard starting at http://localhost:5055
echo echo  Press Ctrl+C to stop.
echo echo.
echo timeout /t 2 /nobreak ^>nul
echo start "" "http://localhost:5055"
echo python dashboard.py
echo pause
) > start.bat

echo.
echo  ==========================================
echo   Setup complete!
echo  ==========================================
echo.
echo  Your dashboard is ready with:
echo   - 6 records loaded (PayPal, E.ON, Octopus, Hyundai, McAfee)
echo   - Claude AI at /chat
echo   - Banking page at /banking
echo.
echo  FROM NOW ON: just double-click  household\start.bat
echo.
echo  Launching now...
echo.

timeout /t 2 /nobreak >nul
start "" "http://localhost:5055"
python dashboard.py

pause
