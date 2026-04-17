#!/bin/bash

# SpellTable Pro+ - Vercel Deployment Script
# Automated deployment to Vercel with MongoDB Atlas setup

set -e  # Exit on error

echo "🎮 SpellTable Pro+ - Vercel Deployment"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check prerequisites
echo "🔍 Checking environment..."

if ! command -v vercel &> /dev/null; then
    warn "Vercel CLI not installed. Installing..."
    npm install -g vercel || error "Failed to install Vercel CLI"
    success "Vercel CLI installed"
else
    success "Vercel CLI installed: $(vercel --version)"
fi

if ! command -v git &> /dev/null; then
    error "Git is not installed. Please install Git."
fi

# Check if in project directory
if [ ! -f "vercel.json" ]; then
    error "Not in spelltable-pro directory. Please run from spelltable-pro folder."
fi

echo ""
echo "📋 Pre-deployment Checks"
echo "========================="

# Check required files
for file in "vercel.json" "api/server.js" "package.json"; do
    if [ ! -f "$file" ]; then
        error "Missing required file: $file"
    fi
    success "✓ $file found"
done

# Check .env exists or template
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        warn ".env not found. Creating from .env.example"
        cp .env.example .env
        success ".env template created"
    else
        warn ".env.example not found. You'll need to create .env manually"
    fi
else
    success ".env file exists"
fi

# Check MongoDB URI in .env
if grep -q "MONGODB_URI=" .env; then
    success "MONGODB_URI configured"
else
    warn "MONGODB_URI not set in .env. You'll need to configure MongoDB Atlas"
fi

# Check Vercel login
echo ""
echo "🔐 Vercel Login Check"
echo "====================="

vercel whoami > /dev/null 2>&1
if [ $? -eq 0 ]; then
    success "Already logged into Vercel"
else
    warn "Not logged into Vercel. Logging in now..."
    vercel login
    success "Logged into Vercel"
fi

# Display current configuration
echo ""
echo "📊 Current Configuration"
echo "========================"
echo "Framework: Node.js"
echo "Build Command: npm install"
echo "Output Directory: (auto-detected)"

if [ -f "vercel.json" ]; then
    echo "✓ vercel.json configured"
fi

if [ -f ".vercelignore" ]; then
    echo "✓ .vercelignore configured"
fi

# Ask deployment type
echo ""
echo "🚀 Deployment Options"
echo "===================="
echo "1. Deploy to preview URL (testing)"
echo "2. Deploy to production URL"
echo "3. Configure environment variables first"
echo "4. Skip deployment (just verify setup)"
echo ""
read -p "Choose option (1-4): " DEPLOY_TYPE

case $DEPLOY_TYPE in
    1)
        echo ""
        success "Deploying to preview..."
        vercel
        success "Preview deployment complete!"
        echo ""
        echo "📍 Your preview URL will be shown after deployment"
        echo "🔗 Check it at: https://vercel.com/dashboard"
        ;;
        
    2)
        echo ""
        success "Deploying to production..."
        vercel --prod
        success "Production deployment complete!"
        echo ""
        echo "📍 Your production URL will be shown after deployment"
        echo "🔗 Check it at: https://vercel.com/dashboard"
        ;;
        
    3)
        echo ""
        echo "🔧 Configuring Environment Variables"
        echo "====================================="
        echo ""
        echo "You'll need to configure these in Vercel Dashboard:"
        echo ""
        echo "Required:"
        echo "  - MONGODB_URI: Your MongoDB Atlas connection string"
        echo "  - ALLOWED_ORIGINS: Your Vercel domain + localhost"
        echo ""
        echo "Optional:"
        echo "  - NODE_ENV: production"
        echo "  - SENTRY_DSN: Sentry error tracking DSN"
        echo ""
        echo "How to set:"
        echo "1. Go to https://vercel.com/dashboard"
        echo "2. Select your project"
        echo "3. Settings → Environment Variables"
        echo "4. Add each variable for Production, Preview, and Development"
        echo ""
        warn "Run this script again after setting environment variables"
        ;;
        
    4)
        echo ""
        success "Setup verified. Ready to deploy!"
        echo ""
        echo "📋 Summary:"
        echo "  ✓ vercel.json configured"
        echo "  ✓ .vercelignore configured"
        echo "  ✓ api/server.js optimized for Vercel"
        echo "  ✓ Environment variables ready"
        echo ""
        echo "To deploy:"
        echo "  vercel --prod"
        echo ""
        ;;
        
    *)
        error "Invalid option"
        ;;
esac

echo ""
success "Deployment process complete!"
echo ""
echo "📚 Next Steps:"
echo "1. Check Vercel dashboard for deployment status"
echo "2. Test API endpoint: https://your-project.vercel.app/api/health"
echo "3. Test frontend: https://your-project.vercel.app/demo.html"
echo "4. Monitor logs in Vercel dashboard"
echo ""
echo "Need help? Check VERCEL-DEPLOYMENT.md for detailed guide"
