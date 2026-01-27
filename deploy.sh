#!/bin/bash

# Deployment Script for Hostinger VPS
# Usage: ./deploy.sh

echo "🚀 Starting Deployment..."

# 1. Pull latest changes from GitHub
echo "📥 Pulling latest code..."
git pull origin main

# 2. Install dependencies (backend & frontend)
echo "📦 Installing dependencies (Reinstalling backend modules)..."
rm -rf node_modules
npm install

# 3. Build the React Frontend
echo "🏗️ Building React Frontend..."
npm run build

# 4. Restart the Server via PM2
echo "🔄 Restarting Server..."
pm2 startOrRestart ecosystem.config.cjs --env production

echo "✅ Deployment Complete! App is running on Port 3002."
