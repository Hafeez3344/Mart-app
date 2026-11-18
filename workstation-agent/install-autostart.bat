@echo off
title CarePulse HMS - Install Auto-Start Printer Bridge
color 0A
cd /d "%~dp0"

echo =================================================================
echo   CarePulse HMS - Workstation Printer Auto-Start Installer
echo =================================================================
echo.
echo Installing silent background service for Windows startup...
echo.

set "VBS_PATH=%~dp0run-hidden.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\CarePulse-Printer-Bridge.lnk"

:: Create shortcut in Windows Startup folder using PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; " ^
  "$Shortcut = $WshShell.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$Shortcut.TargetPath = 'wscript.exe'; " ^
  "$Shortcut.Arguments = '\"%VBS_PATH%\"'; " ^
  "$Shortcut.WorkingDirectory = '%~dp0'; " ^
  "$Shortcut.Description = 'CarePulse Workstation Silent Thermal Printer Bridge'; " ^
  "$Shortcut.Save()"

if %errorlevel% neq 0 (
  echo [ERROR] Failed to create startup shortcut.
  pause
  exit /b 1
)

echo [OK] Startup shortcut created:
echo      %SHORTCUT_PATH%
echo.

:: Stop any old process listening on port 5005
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-NetTCPConnection -LocalPort 5005 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

:: Start silent background bridge right now
start "" wscript.exe "%VBS_PATH%"

echo =================================================================
echo   SUCCESS! Auto-Start Installation Complete!
echo =================================================================
echo.
echo 1. The printer bridge is now RUNNING SILENTLY in the background.
echo 2. There is NO black terminal window to accidentally close.
echo 3. It will automatically start every time this computer boots up.
echo.
echo You can close this window now.
echo =================================================================
pause
