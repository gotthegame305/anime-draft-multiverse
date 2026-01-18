import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export async function POST() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Generate unique room code
        let code = generateRoomCode();
        let existing = await prisma.room.findUnique({ where: { code } });

        while (existing) {
            code = generateRoomCode();
            existing = await prisma.room.findUnique({ where: { code } });
        }

        // Create room
        const room = await prisma.room.create({
            data: {
                code,
                hostId: session.user.id,
                players: {
                    create: {
                        userId: session.user.id,
                        isSpectator: false,
                    }
                }
            },
            include: {
                players: true,
            }
        });

        return NextResponse.json(room);
    } catch (error) {
        console.error('Error creating room:', error);
        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
    }
}
