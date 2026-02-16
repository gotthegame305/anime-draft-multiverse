import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { triggerRoomEvent } from '@/lib/pusher';
import { getClientIp, isRateLimited } from '@/lib/rate-limit';

function generateAnonymousId(): string {
    return `anon_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    try {
        const ip = getClientIp(req);
        if (isRateLimited(`rooms:join:${ip}`, 40, 60_000)) {
            return NextResponse.json({ error: 'Too many join attempts' }, { status: 429 });
        }

        const { code, isSpectator, userId: clientUserId } = await req.json();

        // Use authenticated user ID if available, otherwise use provided anonymous ID or generate one
        let userId = session?.user?.id;
        if (!userId) {
            userId = clientUserId;
            if (!userId) {
                userId = generateAnonymousId();
            }
        }

        if (!code || typeof code !== 'string') {
            return NextResponse.json({ error: 'Room code required' }, { status: 400 });
        }

        // Find room
        const room = await prisma.room.findUnique({
            where: { code: code.toUpperCase() },
            include: { players: true }
        });

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        if (room.status !== 'WAITING') {
            return NextResponse.json({ error: 'Game already started' }, { status: 400 });
        }

        // Check if already in room
        const existing = room.players.find((p: { userId: string }) => p.userId === userId);
        if (existing) {
            return NextResponse.json(room);
        }

        // Check player limit
        const activePlayers = room.players.filter((p: { isSpectator: boolean }) => !p.isSpectator);
        if (!isSpectator && activePlayers.length >= room.maxPlayers) {
            return NextResponse.json({ error: 'Room is full' }, { status: 400 });
        }

        // Create anonymous user if needed
        if (!session?.user?.id) {
            const existingUser = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
            
            if (!existingUser) {
                await prisma.user.create({
                    data: {
                        id: userId,
                        name: `Guest ${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                        email: null,
                    }
                });
            }
        }

        // Add player to room
        await prisma.roomPlayer.create({
            data: {
                roomId: room.id,
                userId: userId,
                isSpectator: isSpectator || false,
            }
        });

        // Get updated room
        const updatedRoom = await prisma.room.findUnique({
            where: { id: room.id },
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

        // Trigger real-time event
        await triggerRoomEvent(room.id, 'player-joined', updatedRoom);

        return NextResponse.json(updatedRoom);
    } catch (error) {
        console.error('Error joining room:', error);
        return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
    }
}
