import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { triggerRoomEvent } from '@/lib/pusher';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    req: Request,
    { params }: { params: { roomId: string } }
) {
    try {
        console.log(`[DEBUG] Fetching state for room: ${params.roomId}`);

        if (!params.roomId) {
            console.error('[DEBUG] Room ID missing from params');
            return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
        }

        const room = await prisma.room.findUnique({
            where: { id: params.roomId },
            include: {
                players: {
                    orderBy: { joinedAt: 'asc' },
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

        if (!room) {
            console.warn(`[DEBUG] Room not found: ${params.roomId}`);
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        console.log(`[DEBUG] Room found: ${room.code}, Status: ${room.status}, Players: ${room.players.length}`);
        return NextResponse.json(room);
    } catch (error: unknown) {
        console.error('[DEBUG] FATAL ERROR fetching room state:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: 'Failed to fetch room',
            details: errorMessage
        }, { status: 500 });
    }
}

export async function POST(
    req: Request,
    { params }: { params: { roomId: string } }
) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { action, data } = body;

        console.log(`[DEBUG] Room Action: ${action} for room: ${params.roomId}`);
        if (data) {
            console.log(`[DEBUG] Data keys: ${Object.keys(data).join(', ')}`);
        }

        const room = await prisma.room.findUnique({
            where: { id: params.roomId },
            include: { players: true }
        });

        if (!room) {
            console.warn(`[DEBUG] Room not found: ${params.roomId}`);
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Only host can start game
        if (action === 'start' && room.hostId === session.user.id) {
            console.log(`[DEBUG] Starting game - Wiping old gameState`);
            const updatedRoom = await prisma.room.update({
                where: { id: params.roomId },
                data: {
                    status: 'DRAFTING',
                    startedAt: new Date(),
                    gameState: null // Important: Wipe old bloated state
                }
            });

            await triggerRoomEvent(params.roomId, 'game-started', {});
            return NextResponse.json(updatedRoom);
        }

        // Update game state
        if (action === 'updateState') {
            console.log(`[DEBUG] Updating state - Payload size estimation: ${JSON.stringify(data).length} chars`);
            const updatedRoom = await prisma.room.update({
                where: { id: params.roomId },
                data: { gameState: data }
            });

            await triggerRoomEvent(params.roomId, 'state-updated', data);
            return NextResponse.json(updatedRoom);
        }
        // ... (rest of leave/end logic)

        // Return existing end/leave logic
        if (action === 'end') {
            const updatedRoom = await prisma.room.update({
                where: { id: params.roomId },
                data: { status: 'FINISHED' }
            });
            await triggerRoomEvent(params.roomId, 'game-ended', data);
            return NextResponse.json(updatedRoom);
        }

        if (action === 'leave') {
            await prisma.roomPlayer.deleteMany({
                where: { roomId: params.roomId, userId: session.user.id }
            });
            await triggerRoomEvent(params.roomId, 'player-left', { userId: session.user.id });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        console.error('[DEBUG] POST Error updating room state:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as { code?: string }).code;

        return NextResponse.json({
            error: 'Failed to update room',
            details: errorMessage,
            code: errorCode // Prisma error code
        }, { status: 500 });
    }
}
