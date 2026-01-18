export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
    const diag = {
        PROJECT_NAME: process.env.VERCEL_PROJECT_NAME,
        ENVIRONMENT: process.env.VERCEL_ENV,
        REGION: process.env.VERCEL_REGION,
        ENV_KEYS_COUNT: Object.keys(process.env).length,
        ALL_KEYS: Object.keys(process.env).sort(),
        GOOGLE_CLIENT_ID_EXISTS: !!(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
        DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
        NEXTAUTH_SECRET_EXISTS: !!(process.env.NEXTAUTH_SECRET || process.env.NEXT_PUBLIC_NEXTAUTH_SECRET),
        PUSHER_KEYS_EXISTS: !!(process.env.PUSHER_KEY && process.env.PUSHER_CLUSTER && process.env.PUSHER_APP_ID),
        NEXT_PUBLIC_PUSHER_EXISTS: !!(process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER),
        VERSION_ID: "7.0-PUSHER-SCAN",
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(diag);
}
