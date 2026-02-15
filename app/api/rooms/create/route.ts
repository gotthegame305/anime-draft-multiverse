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

function generateAnonymousId(): string {
    return `anon_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST() {
    const session = await getServerSession(authOptions);

    // Allow both authenticated and anonymous users
    const userId = session?.user?.id || generateAnonymousId();

    try {
        // Generate unique room code
        let code = generateRoomCode();
        let existing = await prisma.room.findUnique({ where: { code } });

        while (existing) {
            code = generateRoomCode();
            existing = await prisma.room.findUnique({ where: { code } });
        }

        // Create anonymous user if needed
        let user = null;
        if (!session?.user?.id) {
            // Check if anonymous user exists
            user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
            
            if (!user) {
                // Create anonymous user
                user = await prisma.user.create({
                    data: {
                        id: userId,
                        name: `Guest ${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                        email: null,
                    }
                });
            }
        }

        // Create room
        const room = await prisma.room.create({
            data: {
                code,
                hostId: userId,
                players: {
                    create: {
                        userId: userId,
                        isSpectator: false,
                    }
                }
            },
            include: {
                players: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                                username: true,
                                avatarUrl: true
                            }
                        }
                    }
                }
            }
        });

        return NextResponse.json(room);
    } catch (error) {
        console.error('Error creating room:', error);
        return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
    }
}
