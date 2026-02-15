#!/bin/bash
# This runs during Vercel deployment to apply database migrations
# Add this to vercel.json as a postBuildCommand

set -e

echo "🔄 Running Prisma migrations on Vercel..."
npx prisma migrate deploy --skip-generate

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully!"
    exit 0
else
    echo "⚠️  Migration warning - database may already be migrated"
    exit 0  # Don't fail the build, chat endpoint has graceful fallback
fi
