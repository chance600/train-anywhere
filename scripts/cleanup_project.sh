#!/bin/bash
echo "🧹 Starting Deep Clean..."

# 1. Remove Dependencies
echo "🗑️  Removing node_modules..."
rm -rf node_modules

# 2. Remove Build Artifacts
echo "🗑️  Removing build artifacts..."
rm -rf dist
rm -rf .vercel
rm -rf .firebase

# 3. Remove Locks (Optional, but good for reset)
echo "🗑️  Removing lock files (to force refresh)..."
rm -f package-lock.json
rm -f yarn.lock

# 4. Clear npm cache (Safe mode)
echo "🧹 Verifying cache..."
npm cache verify

echo "✨ Clean Complete."
echo "👉 Run 'npm install' to rehydrate the project."
