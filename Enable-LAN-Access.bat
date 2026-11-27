
@echo off
title Enable Hotspot Access for SuperMart POS
color 0A

:: Check for administrative rights and self-elevate
>nul 2>&1 fsutil dirty query %systemdrive%
if %errorLevel% NEQ 0 (
    echo Requesting Administrator Permission...
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\uac_elevate.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\uac_elevate.vbs"
    "%temp%\uac_elevate.vbs"
    del "%temp%\uac_elevate.vbs"
    exit /b
)

:: Running with Administrator rights
cls
echo ======================================================================
echo           SuperMart POS - Enabling LAN & Hotspot Access
echo ======================================================================
echo.

echo [1/3] Clearing any old firewall rules...
netsh advfirewall firewall delete rule name="SuperMart POS Client (Port 3000)" >nul 2>&1
netsh advfirewall firewall delete rule name="SuperMart POS Server (Port 5000)" >nul 2>&1

echo [2/3] Opening Port 3000 (Next.js Frontend) on ALL network profiles...
netsh advfirewall firewall add rule name="SuperMart POS Client (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=any

echo [3/3] Opening Port 5000 (Express Backend) on ALL network profiles...
netsh advfirewall firewall add rule name="SuperMart POS Server (Port 5000)" dir=in action=allow protocol=TCP localport=5000 profile=any

echo Switching Wi-Fi connection profile to Private...
powershell -NoProfile -Command "Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private" >nul 2>&1

echo.
echo ======================================================================
echo   SUCCESS! Windows Firewall has unlocked Port 3000 and 5000!
echo ======================================================================
echo.
echo Now open Google Chrome on your mobile and go to:
echo.
echo     http://10.131.56.148:3000/pos
echo.
echo ======================================================================
echo Press any key to close this window.
pause >nul
