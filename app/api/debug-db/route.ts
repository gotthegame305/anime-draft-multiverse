import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        // Try a simple query
        const userCount = await prisma.user.count();
        const roomCount = await prisma.room.count();

        return NextResponse.json({
            success: true,
            status: 'Database connected',
            userCount,
            roomCount,
            dbUrlType: process.env.DATABASE_URL?.startsWith('prisma') ? 'Accelerate' : 'Standard'
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack,
            envSet: !!process.env.DATABASE_URL
        }, { status: 500 });
    }
}
