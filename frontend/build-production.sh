#!/bin/bash

# Production build script for Fayshaa Frontend
# This script builds the frontend with production API configuration

echo "🏗️  Building frontend for production..."
REACT_APP_API_URL="/api" npm run build

if [ $? -eq 0 ]; then
  echo "✅ Build successful!"
  echo ""
  echo "📦 Deploying to production server..."
  rsync -avz --delete build/ root@76.13.41.99:/var/www/fayshaa/frontend/

  if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🔄 Reloading nginx..."
    ssh root@76.13.41.99 "nginx -t && systemctl reload nginx"
    echo ""
    echo "🎉 Frontend deployed successfully!"
    echo "🌐 Site: https://fayshaa.com"
    echo "👨‍💼 Admin: https://fayshaa.com/admin"
  else
    echo "❌ Deployment failed!"
    exit 1
  fi
else
  echo "❌ Build failed!"
  exit 1
fi
