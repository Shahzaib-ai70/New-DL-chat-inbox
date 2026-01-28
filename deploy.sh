#!/bin/bash

# Deployment Script for Hostinger VPS
# Usage: ./deploy.sh

echo "🚀 Starting Deployment..."

# 1. Pull latest changes from GitHub
echo "📥 Pulling latest code..."
git pull origin main

# 2. Install dependencies (backend & frontend)
echo "📦 Installing dependencies..."
# Only remove if specifically requested or corrupted, otherwise standard install updates it
npm install

# 2.5 Ensure Data Directory Persistence
echo "💾 configuring data persistence..."
mkdir -p data
mkdir -p .wwebjs_auth
chmod -R 777 data
chmod -R 777 .wwebjs_auth

# 3. Build the React Frontend
echo "🏗️ Building React Frontend..."
npm run build

# 4. Restart the Server via PM2
echo "🔄 Restarting Server..."
pm2 startOrRestart ecosystem.config.cjs --env production

echo "✅ Deployment Complete! App is running on Port 3002."
