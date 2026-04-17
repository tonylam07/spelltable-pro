@echo off
echo ============ File Structure Check ============
echo.
cd /d "%~dp0"
echo Current directory: %CD%
echo.
echo 📁 Directory structure:
dir /b
echo.
echo 📁 css/ directory:
dir css\*.* /b
echo.
echo 📁 js/ directory:
dir js\*.* /b
echo.
echo 📁 api/ directory:
dir api\*.* /b
echo.
echo Press any key to exit...
pause >nul
