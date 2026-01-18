export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
    const diag = {
        GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
        DISCORD_CLIENT_ID: !!process.env.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: !!process.env.DISCORD_CLIENT_SECRET,
        NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
        NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
        DATABASE_URL: !!process.env.DATABASE_URL,
        VERSION_ID: "3.0-DEFINITIVE",
        COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || 'no-sha',
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(diag);
}
