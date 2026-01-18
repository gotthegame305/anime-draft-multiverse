export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
    const diag = {
        ENV_KEYS_COUNT: Object.keys(process.env).length,
        ALL_KEYS_ALPHABETICAL: Object.keys(process.env).sort(),
        GOOGLE_CLIENT_ID_EXISTS: !!process.env.GOOGLE_CLIENT_ID,
        DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
        NEXTAUTH_SECRET_EXISTS: !!process.env.NEXTAUTH_SECRET,
        VERSION_ID: "5.0-EXHAUSTIVE-SCAN",
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(diag);
}
