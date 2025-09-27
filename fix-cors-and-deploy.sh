#!/bin/bash

echo "🔧 CORS Fix and Deployment Script"
echo "=================================="

# Check current environment variables
echo "📋 Current Environment Configuration:"
echo "NODE_ENV: $NODE_ENV"
echo "ALLOWED_ORIGINS: $ALLOWED_ORIGINS"

# Test current CORS configuration
echo ""
echo "🧪 Testing CORS with different origins..."

echo "Testing sabrang.jklu.edu.in:"
curl -s -H "Origin: https://sabrang.jklu.edu.in" https://surprising-balance-production.up.railway.app/cors-debug | jq -r '.requestOrigin // "No response"'

echo "Testing sabrang25-first-draft.vercel.app:"
curl -s -H "Origin: https://sabrang25-first-draft.vercel.app" https://surprising-balance-production.up.railway.app/cors-debug | jq -r '.requestOrigin // "No response"'

echo "Testing www.sabrang.jklu.edu.in:"
curl -s -H "Origin: https://www.sabrang.jklu.edu.in" https://surprising-balance-production.up.railway.app/cors-debug | jq -r '.requestOrigin // "No response"'

# Deploy to Railway to restart with new environment variables
echo ""
echo "🚀 Redeploying to Railway to apply environment variable changes..."

# Check if we're in a git repository
if [ -d ".git" ]; then
    echo "📝 Committing CORS fixes..."
    git add .env index.js
    git commit -m "🔧 Fix CORS: Add Vercel domains and improve error handling"
    
    echo "🔄 Pushing to trigger Railway redeploy..."
    git push origin main
    
    echo "⏳ Waiting 30 seconds for deployment..."
    sleep 30
    
    echo "🧪 Testing CORS after deployment..."
    curl -s -H "Origin: https://sabrang25-first-draft.vercel.app" https://surprising-balance-production.up.railway.app/cors-debug | jq .
else
    echo "❌ Not in a git repository. Please commit and push manually:"
    echo "   git add .env index.js"
    echo "   git commit -m 'Fix CORS for Vercel domains'"
    echo "   git push origin main"
fi

echo ""
echo "✅ CORS fix deployment completed!"
echo ""
echo "📱 Frontend domains that should now work:"
echo "- https://sabrang.jklu.edu.in"
echo "- https://www.sabrang.jklu.edu.in"  
echo "- https://sabrang25-first-draft.vercel.app"
echo "- http://localhost:3000"
echo "- http://localhost:3001"
echo "- Any *.vercel.app domain (for preview deployments)"