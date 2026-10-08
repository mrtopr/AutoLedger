@echo off
title TradeLedger Universal B2B Wholesale & Khata ERP
echo ======================================================================
echo          TradeLedger Universal B2B Wholesale & Khata ERP
echo ======================================================================
echo.
cd /d "%~dp0"

echo [1/2] Connecting to PostgreSQL Database & Web Engine...
start /b cmd /c "npm run dev"

echo [2/2] Launching TradeLedger ERP Desktop Window...
timeout /t 2 /nobreak >nul

if exist "dist\win-unpacked\TradeLedger ERP.exe" (
    start "" "dist\win-unpacked\TradeLedger ERP.exe"
) else if exist "dist\TradeLedger ERP 1.0.0.exe" (
    start "" "dist\TradeLedger ERP 1.0.0.exe"
) else (
    start http://localhost:3000
)

echo.
echo  TradeLedger ERP Desktop App is running live!
echo  Installer and EXE are located in: %~dp0dist\
echo ======================================================================
timeout /t 5 >nul
exit
