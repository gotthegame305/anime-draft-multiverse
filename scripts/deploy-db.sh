#!/bin/bash
# Migration deployment script for Vercel
# This script runs all pending Prisma migrations

echo "🔄 Starting database migration..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi
