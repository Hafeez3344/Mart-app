@echo off
:: ============================================================================
:: SET PERMANENT STATIC IP FOR HOSPITAL SERVER (ETHERNET)
:: Run as Administrator
:: ============================================================================
echo.
echo =====================================================================
echo    AL SHIFA HOSPITAL MANAGEMENT SYSTEM - PERMANENT STATIC IP TOOL
echo =====================================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This script MUST be run as Administrator!
    echo Right-click SET_PERMANENT_STATIC_IP.bat and select 'Run as administrator'.
    echo.
    pause
    exit /b 1
)

echo Choose an option:
echo.
echo  [1] Set Permanent Static IP to 192.168.10.20 (Recommended)
echo  [2] Set Permanent Static IP to 192.168.10.26
echo  [3] Reset Ethernet back to Automatic (DHCP)
echo.
set /p opt="Enter your choice (1, 2, or 3): "

if "%opt%"=="1" goto set20
if "%opt%"=="2" goto set26
if "%opt%"=="3" goto setdhcp
echo Invalid choice.
pause
exit /b

:set20
echo.
echo Setting Ethernet IP to 192.168.10.20 statically...
netsh interface ip set address name="Ethernet" static 192.168.10.20 255.255.255.0 192.168.10.1 1
netsh interface ip set dns name="Ethernet" static 192.168.10.1
netsh interface ip add dns name="Ethernet" 8.8.8.8 index=2
powershell -NoProfile -Command "Get-NetConnectionProfile -InterfaceAlias 'Ethernet' | Set-NetConnectionProfile -NetworkCategory Private"
echo.
echo [DONE] Permanent Static IP set to: 192.168.10.20
echo You can now access HMS at: http://192.168.10.20:3000
goto end

:set26
echo.
echo Setting Ethernet IP to 192.168.10.26 statically...
netsh interface ip set address name="Ethernet" static 192.168.10.26 255.255.255.0 192.168.10.1 1
netsh interface ip set dns name="Ethernet" static 192.168.10.1
netsh interface ip add dns name="Ethernet" 8.8.8.8 index=2
powershell -NoProfile -Command "Get-NetConnectionProfile -InterfaceAlias 'Ethernet' | Set-NetConnectionProfile -NetworkCategory Private"
echo.
echo [DONE] Permanent Static IP set to: 192.168.10.26
echo You can now access HMS at: http://192.168.10.26:3000
goto end

:setdhcp
echo.
echo Resetting Ethernet to Automatic DHCP...
netsh interface ip set address name="Ethernet" dhcp
netsh interface ip set dns name="Ethernet" dhcp
echo [DONE] Ethernet is now set to Automatic (DHCP).
goto end

:end
echo.
pause
