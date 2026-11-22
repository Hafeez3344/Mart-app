@echo off
title Super Mart POS - Desktop Launcher
color 0A

echo.
echo  =====================================================
echo   SUPER MART POINT OF SALE (ELECTRON DESKTOP ENGINE)
echo  =====================================================
echo.

set ROOT_DIR=%~dp0
if "%ROOT_DIR:~-1%"=="\" set ROOT_DIR=%ROOT_DIR:~0,-1%
set PG_BIN=F:\pg17\pgsql\bin
set PATH=%PG_BIN%;%PATH%

:: Ensure Electron runs in full GUI desktop mode
set ELECTRON_RUN_AS_NODE=

cd /d %ROOT_DIR%

:: -------------------------------------------------------
:: STEP 1: PostgreSQL Port 5432
:: -------------------------------------------------------
echo  [1/4] Verifying PostgreSQL...
"%PG_BIN%\pg_ctl.exe" status -D "F:\pg17\data" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo        Starting PostgreSQL database...
    "%PG_BIN%\pg_ctl.exe" -D "F:\pg17\data" -l "F:\pg17\pg.log" start
    timeout /t 3 /nobreak >nul
) else (
    echo        PostgreSQL is already active on port 5432.
)

:: -------------------------------------------------------
:: STEP 2: Express Backend Port 5000
:: -------------------------------------------------------
echo.
echo  [2/4] Verifying Express API Backend (port 5000)...
netstat -ano | findstr ":5000" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo        Starting Express API Server in background...
    start "Super Mart POS - API Backend" /min cmd /c "cd /d %ROOT_DIR%\server && set PATH=%PG_BIN%;%PATH% && node src/server.js"
    timeout /t 3 /nobreak >nul
) else (
    echo        Express API Server is already active on port 5000.
)

:: -------------------------------------------------------
:: STEP 3: Next.js Frontend Port 3000
:: -------------------------------------------------------
echo.
echo  [3/4] Verifying Next.js POS Frontend (port 3000)...
netstat -ano | findstr ":3000" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo        Starting Next.js Frontend in background...
    start "Super Mart POS - Frontend" /min cmd /c "cd /d %ROOT_DIR%\client && node node_modules/next/dist/bin/next dev"
    timeout /t 5 /nobreak >nul
) else (
    echo        Next.js Frontend is already active on port 3000.
)

:: -------------------------------------------------------
:: STEP 4: Launch Native Electron POS Desktop Window
:: -------------------------------------------------------
echo.
echo  [4/4] Launching Native Electron POS Window...
start "" "%ROOT_DIR%\node_modules\electron\dist\electron.exe" "%ROOT_DIR%"

echo.
echo  =====================================================
echo   Super Mart POS Desktop Application is now OPEN!
echo.
echo   Local Terminal:  http://localhost:3000/pos
echo   Admin Panel:     http://localhost:3000/admin
echo   Default Login:   admin@mart.com / admin123
echo  =====================================================
echo.
echo  You may close this launcher window at any time.
echo.
pause
