import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { triggerRoomEvent } from '@/lib/pusher';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { code, isSpectator } = await req.json();

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
        const existing = room.players.find(p => p.userId === session.user.id);
        if (existing) {
            return NextResponse.json(room);
        }

        // Check player limit
        const activePlayers = room.players.filter(p => !p.isSpectator);
        if (!isSpectator && activePlayers.length >= room.maxPlayers) {
            return NextResponse.json({ error: 'Room is full' }, { status: 400 });
        }

        // Add player to room
        await prisma.roomPlayer.create({
            data: {
                roomId: room.id,
                userId: session.user.id,
                isSpectator: isSpectator || false,
            }
        });

        // Get updated room
        const updatedRoom = await prisma.room.findUnique({
            where: { id: room.id },
            include: { players: true }
        });

        // Trigger real-time event
        await triggerRoomEvent(room.id, 'player-joined', {
            userId: session.user.id,
            isSpectator: isSpectator || false,
        });

        return NextResponse.json(updatedRoom);
    } catch (error) {
        console.error('Error joining room:', error);
        return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
    }
}
