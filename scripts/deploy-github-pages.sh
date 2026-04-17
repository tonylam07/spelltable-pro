#!/bin/bash

# SpellTable Pro+ - GitHub Deployment Script
# Automates the deployment process

set -e  # Exit on error

echo "🎮 SpellTable Pro+ Deployment Script"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print success message
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error message
error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Function to print warning message
warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check Node.js version
echo "🔍 Checking environment..."
if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install Node.js 18+"
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 18+ required. Current version: $(node -v)"
fi
success "Node.js version: $(node -v)"

# Check Git
if ! command -v git &> /dev/null; then
    error "Git is not installed. Please install Git."
fi
success "Git version: $(git --version)"

# Check if in correct directory
if [ ! -f "package.json" ]; then
    error "Not in spelltable-pro directory. Please run this script from the spelltable-pro folder."
fi

echo ""
echo "📦 Installing dependencies..."
npm install || error "npm install failed"
success "Dependencies installed"

echo ""
echo "🔧 Checking configuration..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    warn "No .env file found. Creating template..."
    cat > .env <<EOF
# SpellTable Pro+ Configuration
PORT=3000
MONGODB_URI=mongodb://localhost:27017/spelltable-pro
ALLOWED_ORIGINS=http://localhost:3000,https://yourusername.github.io
NODE_ENV=development

# MongoDB Atlas (for production)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/spelltable-pro

# Production domains
# ALLOWED_ORIGINS=https://yourusername.github.io,https://yourdomain.com
EOF
    success ".env template created"
else
    success ".env file found"
fi

echo ""
echo "🧪 Testing build..."
npm run build || warn "Build script not found or failed"

echo ""
echo "🔍 Checking git status..."
if [ -z "$(git status --porcelain)" ]; then
    success "Working directory is clean"
else
    warn "Working directory has uncommitted changes"
    git status
    read -p "Commit changes before deploying? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Deployment cancelled"
    fi
    git add .
    git commit -m "Deploy SpellTable Pro+ $(date +%Y-%m-%d)"
fi

echo ""
echo "🚀 Deployment options:"
echo "1. Deploy backend API to Railway/Render (recommended)"
echo "2. Deploy static frontend to GitHub Pages (frontend only)"
echo "3. Skip deployment (just verify setup)"
echo ""
read -p "Choose deployment option (1-3): " DEPLOY_TYPE

case $DEPLOY_TYPE in
    1)
        echo ""
        echo "🌐 Backend API Deployment"
        echo "Recommended: Railway.app (free tier)"
        echo ""
        echo "Steps to deploy to Railway:"
        echo "1. Create account at https://railway.app"
        echo "2. Click 'New Project'"
        echo "3. Connect your GitHub repository"
        echo "4. Add environment variables:"
        echo "   - MONGODB_URI (MongoDB Atlas connection string)"
        echo "   - NODE_ENV=production"
        echo "   - ALLOWED_ORIGINS (your GitHub Pages URL)"
        echo "5. Deploy automatically when you push to main"
        echo ""
        success "Backend deployment ready!"
        ;;
    2)
        echo ""
        echo "📄 Frontend Deployment to GitHub Pages"
        echo ""
        echo "Steps to deploy to GitHub Pages:"
        echo "1. Ensure your repository is pushed to GitHub"
        echo "2. Go to Repository Settings → Pages"
        echo "3. Select 'Deploy from branch'"
        echo "4. Branch: main, Folder: / (root)"
        echo "5. Update CORS in api/server.js with your GitHub Pages URL"
        echo ""
        echo "Optional: Install gh-pages for automated deployments"
        echo "  npm install --save-dev gh-pages"
        echo "  npx gh-pages -d spelltable-pro/dist"
        echo ""
        success "Frontend deployment ready!"
        ;;
    3)
        echo ""
        echo "⏭️  Skipping deployment"
        echo ""
        success "Setup verification complete!"
        ;;
    *)
        error "Invalid option"
        ;;
esac

echo ""
echo "📋 Next Steps:"
echo "1. Test locally: npm start"
echo "2. Open: http://localhost:3000/demo.html"
echo "3. Check console for '✅ MongoDB connected'"
echo "4. Follow deployment instructions above"
echo ""
success "SpellTable Pro+ deployment setup complete!"
echo ""
echo "Need help? Check DEPLOYMENT.md for detailed instructions."
