export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
    const diag = {
        ENV_KEYS_COUNT: Object.keys(process.env).length,
        ENV_KEYS_PREVIEW: Object.keys(process.env).filter(k =>
            k.startsWith('GOOGLE') ||
            k.startsWith('DISCORD') ||
            k.startsWith('NEXTAUTH') ||
            k.startsWith('DATABASE') ||
            k.startsWith('AUTH') ||
            k.startsWith('VERCEL')
        ).sort(),
        GOOGLE_CLIENT_ID_EXISTS: !!process.env.GOOGLE_CLIENT_ID,
        DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
        VERSION_ID: "4.0-DEEP-SCAN",
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(diag);
}
