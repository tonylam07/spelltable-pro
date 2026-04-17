# SpellTable Pro+ - Start Server Script
# PowerShell version for Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SpellTable Pro+ API Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ ERROR: Node.js not found!" -ForegroundColor Red
    Write-Host "  Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Yellow
    Write-Host "  Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "Installing dependencies... -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ ERROR: Failed to install dependencies" -ForegroundColor Red
        Write-Host "  Press any key to exit..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
    Write-Host ""
}

# Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host ""
    Write-Host "WARNING: .env file not found" -ForegroundColor Yellow
    Write-Host "Creating default .env file..." -ForegroundColor Yellow
    Write-Host ""
    "
# Server
NODE_ENV=development
PORT=3000

# API Keys
MTG_API_KEY=your_scryfall_api_key

# WebSocket
WEBSOCKET_URL=ws://localhost:3000/ws

# WebRTC
STUN_SERVER=stun:stun.l.google.com:19302
" | Out-File -FilePath ".env" -Encoding UTF8
    
    Write-Host "  ✓ Created .env file with defaults" -ForegroundColor Green
    Write-Host "  ⚠ Please edit .env and add your Scryfall API key" -ForegroundColor Yellow
    Write-Host ""
}

# Start server
Write-Host ""
Write-Host "Starting SpellTable Pro+ API server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "API Endpoint:    http://localhost:3000/api/health" -ForegroundColor White
Write-Host "Demo Page:       http://localhost:3000/demo.html" -ForegroundColor White
Write-Host "WebSocket:       ws://localhost:3000/ws" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start the Express server
node api/server.js
