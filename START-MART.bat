@echo off
title Super Mart POS - Startup
color 0A

echo.
echo  =====================================================
echo   SUPER MART POINT OF SALE SYSTEM
echo   Starting all services...
echo  =====================================================
echo.

:: -------------------------------------------------------
:: STEP 1: Start PostgreSQL (Portable)
:: -------------------------------------------------------
echo [1/3] Starting PostgreSQL database...
set PG_BIN=F:\pg17\pgsql\bin
set PG_DATA=F:\pg17\data
set PG_LOG=F:\pg17\pg.log

"%PG_BIN%\pg_ctl.exe" status -D "%PG_DATA%" >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo       PostgreSQL already running. Skipping.
) else (
    "%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" -l "%PG_LOG%" start
    timeout /t 4 /nobreak >nul
    echo       PostgreSQL started on port 5432
)

echo.

:: -------------------------------------------------------
:: STEP 2: Start Backend (Express API on port 5000)
:: -------------------------------------------------------
echo [2/3] Starting Backend API server (port 5000)...
set ROOT_DIR=%~dp0
set SERVER_DIR=%ROOT_DIR%server
start "Mart POS - Backend [Port 5000]" cmd /k "cd /d %SERVER_DIR% && set PATH=%PG_BIN%;%PATH% && node src/server.js"
timeout /t 3 /nobreak >nul
echo       Backend started at http://localhost:5000

echo.

:: -------------------------------------------------------
:: STEP 3: Start Frontend (Next.js on port 3000)
:: -------------------------------------------------------
echo [3/3] Starting Frontend (Next.js) on port 3000...
set CLIENT_DIR=%ROOT_DIR%client
start "Mart POS - Frontend [Port 3000]" cmd /k "cd /d %CLIENT_DIR% && node node_modules/next/dist/bin/next dev"
timeout /t 5 /nobreak >nul
echo       Frontend starting at http://localhost:3000

echo.
echo  =====================================================
echo   ALL SERVICES LAUNCHED!
echo  =====================================================
echo.
echo   Frontend  : http://localhost:3000
echo   Backend   : http://localhost:5000
echo   Database  : localhost:5432 (mart_pos_db)
echo.
echo   LOGIN CREDENTIALS:
echo   Admin   : admin@mart.com   / admin123
echo   Cashier : cashier@mart.com / admin123
echo   Manager : manager@mart.com / admin123
echo.
echo   Opening browser in 5 seconds...
echo  =====================================================
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo  Press any key to close this window...
pause >nul

