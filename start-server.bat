@echo off
echo ================================
echo SpellTable Pro+ API Server
echo ================================
echo.

REM Check if node is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js not found!
    echo Please install Node.js 18+ first.
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    npm install
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

REM Check for .env file
if not exist ".env" (
    echo WARNING: .env file not found
    echo Creating default .env file...
    echo.
    echo # Server
    echo NODE_ENV=development
    echo PORT=3000
    echo.
    echo # API Keys
    echo MTG_API_KEY=your_scryfall_api_key
    echo.
    echo # WebSocket
    echo WEBSOCKET_URL=ws://localhost:3000/ws
    echo.
    echo # WebRTC
    echo STUN_SERVER=stun:stun.l.google.com:19302
    echo. > .env
    echo Created .env file with defaults
    echo Please edit .env and add your Scryfall API key
    echo.
)

REM Start server
echo Starting SpellTable Pro+ API server...
echo API: http://localhost:3000/api/health
echo Demo: http://localhost:3000/demo.html
echo WebSocket: ws://localhost:3000/ws
echo.
echo Press Ctrl+C to stop the server
echo ================================
echo.

node api/server.js

pause
