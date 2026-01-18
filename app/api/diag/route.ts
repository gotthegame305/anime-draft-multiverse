import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";

export async function GET() {
    let dbStatus = "CHECKING...";
    try {
        // @ts-ignore
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = "CONNECTED";
    } catch (e: any) {
        dbStatus = "FAILED: " + e.message;
    }

    const diag = {
        PROJECT_NAME: process.env.VERCEL_PROJECT_NAME,
        ENVIRONMENT: process.env.VERCEL_ENV,
        REGION: process.env.VERCEL_REGION,
        DB_CONNECTION: dbStatus,
        GOOGLE_CLIENT_ID_EXISTS: !!(process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
        DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
        NEXTAUTH_SECRET_EXISTS: !!(process.env.NEXTAUTH_SECRET || process.env.NEXT_PUBLIC_NEXTAUTH_SECRET),
        PUSHER_KEYS_EXISTS: !!(process.env.PUSHER_KEY && process.env.PUSHER_CLUSTER && process.env.PUSHER_APP_ID),
        VERSION_ID: "9.0-DB-CHECK",
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(diag);
}
