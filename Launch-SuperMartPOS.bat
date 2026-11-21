@echo off
title Super Mart POS Desktop Terminal
cd /d "%~dp0"
echo Starting Super Mart POS Desktop Application...
if exist "dist\SuperMartPOS-win32-x64\SuperMartPOS.exe" (
    start "" "dist\SuperMartPOS-win32-x64\SuperMartPOS.exe"
) else (
    echo Packaged executable not found, launching via Electron runtime...
    start "" "node_modules\electron\dist\electron.exe" .
)
