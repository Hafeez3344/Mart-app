@echo off
:: ============================================================================
:: HOSPITAL NETWORK ACCESS FIX TOOL (RUN AS ADMINISTRATOR)
:: Opens Port 3000 (Frontend) and Port 5000 (Backend) on Ethernet & Wi-Fi
:: ============================================================================
echo.
echo =====================================================================
echo    AL SHIFA HOSPITAL MANAGEMENT SYSTEM - ETHERNET / WI-FI FIX
echo =====================================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script MUST be run as Administrator!
    echo Please right-click FIX_HOSPITAL_WIFI_ACCESS.bat and select 'Run as administrator'.
    echo.
    pause
    exit /b 1
)

echo [1/4] Switching Ethernet and Wi-Fi Network Profiles to PRIVATE...
powershell -NoProfile -Command "Get-NetConnectionProfile | Where-Object { $_.InterfaceAlias -match 'Ethernet' -or $_.InterfaceAlias -match 'Wi-Fi' } | Set-NetConnectionProfile -NetworkCategory Private"
if %errorlevel% equ 0 (
    echo    -> Network Profiles successfully changed to PRIVATE.
) else (
    echo    -> Note: Please verify network is set to Private in Windows Settings.
)

echo.
echo [2/4] Refreshing Windows Defender Firewall Rules...
netsh advfirewall firewall delete rule name="HMS Frontend 3000" >nul 2>&1
netsh advfirewall firewall delete rule name="HMS Backend 5000" >nul 2>&1
netsh advfirewall firewall delete rule name="HMS Docker" >nul 2>&1

echo.
echo [3/4] Adding Inbound Firewall Rules for Ports 3000 & 5000 (All Profiles)...
netsh advfirewall firewall add rule name="HMS Frontend 3000" dir=in action=allow protocol=TCP localport=3000 profile=any
netsh advfirewall firewall add rule name="HMS Backend 5000" dir=in action=allow protocol=TCP localport=5000 profile=any

echo.
echo [4/4] Detecting Current Active IP Address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" ^| findstr /v "172."') do (
    set "CURRENT_IP=%%a"
    goto :found_ip
)
:found_ip
set "CURRENT_IP=%CURRENT_IP: =%"

echo.
echo =====================================================================
echo    SUCCESS! YOUR HOSPITAL SERVER IS READY!
echo =====================================================================
echo.
echo Your Hospital Server Local IP: %CURRENT_IP%
echo.
echo Open this link on ANY computer, laptop, or phone connected to the Wi-Fi:
echo.
echo       👉  http://%CURRENT_IP%:3000
echo.
echo =====================================================================
pause
