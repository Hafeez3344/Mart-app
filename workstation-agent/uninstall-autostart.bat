@echo off
title CarePulse HMS - Uninstall Auto-Start Printer Bridge
color 0C
cd /d "%~dp0"

echo =================================================================
echo   CarePulse HMS - Workstation Printer Auto-Start Uninstaller
echo =================================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\CarePulse-Printer-Bridge.lnk"

if exist "%SHORTCUT_PATH%" (
  del /f /q "%SHORTCUT_PATH%"
  echo [OK] Removed startup shortcut from Windows Startup folder.
) else (
  echo [INFO] Startup shortcut was not found.
)

:: Stop any process running on port 5005
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-NetTCPConnection -LocalPort 5005 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [OK] Stopped any running printer bridge processes on port 5005.
echo.
echo Auto-start has been disabled.
echo =================================================================
pause
