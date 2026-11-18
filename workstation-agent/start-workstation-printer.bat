@echo off
title CarePulse HMS - Workstation Thermal Printer Bridge
color 0A
echo =================================================================
echo   CarePulse HMS - Local Workstation Thermal Printer Bridge
echo =================================================================
echo.
echo Starting local silent thermal print service on port 5005...
echo Please do not close this window while using the hospital system.
echo (You can minimize it)
echo.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0workstation-printer.ps1"
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] PowerShell encountered an error.
  pause
)
