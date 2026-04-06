@echo off
cd /d "%~dp0"
title Household Dashboard

rem Load .env variables if the file exists
if exist .env (
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        set "%%a=%%b"
    )
)

echo.
echo  ==========================================
echo   Household Dashboard
echo  ==========================================
echo.
echo  Opening http://localhost:5055
echo  Press Ctrl+C to stop.
echo.

timeout /t 2 /nobreak >nul
start "" "http://localhost:5055"
python dashboard.py

pause
