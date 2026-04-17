@echo off
echo ============ SpellTable Pro+ File Verification ============
echo.
cd /d "%~dp0"
node test-server.js
echo.
echo Press any key to exit...
pause >nul
