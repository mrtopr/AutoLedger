@echo off
title AutoLedger Dealership & Workshop ERP
echo ======================================================================
echo          AutoLedger Motorbike Dealership & Workshop ERP
echo ======================================================================
echo.
cd /d "%~dp0"

echo [1/2] Connecting to PostgreSQL Database & Web Engine...
start /b cmd /c "npm run dev"

echo [2/2] Launching AutoLedger ERP Desktop Window...
timeout /t 2 /nobreak >nul

if exist "dist\win-unpacked\AutoLedger ERP.exe" (
    start "" "dist\win-unpacked\AutoLedger ERP.exe"
) else if exist "dist\AutoLedger ERP 1.0.0.exe" (
    start "" "dist\AutoLedger ERP 1.0.0.exe"
) else (
    start http://localhost:3000
)

echo.
echo  AutoLedger ERP Desktop App is running live!
echo  Installer and EXE are located in: %~dp0dist\
echo ======================================================================
timeout /t 5 >nul
exit
