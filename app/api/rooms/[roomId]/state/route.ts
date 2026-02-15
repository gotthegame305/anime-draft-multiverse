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
        if (!params.roomId) {
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
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Return the room with the players
        return NextResponse.json({
            ...room,
            gameState: room.gameState && Object.keys(room.gameState as object).length > 0 ? room.gameState : null
        });
    } catch (error: unknown) {
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
    try {
        const session = await getServerSession(authOptions);
        const body = await req.json();
        const { userId: bodyUserId, action, data } = body;
        
        if (!params.roomId) {
            return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
        }

        // Allow both authenticated and anonymous users
        const userId = session?.user?.id || bodyUserId;
        if (!userId) {
            return NextResponse.json({ error: 'No user ID' }, { status: 401 });
        }

        // Validate action
        const validActions = ['start', 'updateState', 'end', 'leave', 'chatMessage'] as const;
        if (!action || !validActions.includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const room = await prisma.room.findUnique({
            where: { id: params.roomId },
            include: { players: true }
        });

        if (!room) {
            return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        // Only host can start game
        if (action === 'start') {
            if (room.hostId !== userId) {
                return NextResponse.json({ error: 'Only host can start game' }, { status: 403 });
            }
            const updatedRoom = await prisma.room.update({
                where: { id: params.roomId },
                data: {
                    status: 'DRAFTING',
                    startedAt: new Date(),
                    gameState: {} // Set to empty object for Prisma type safety
                }
            });

            await triggerRoomEvent(params.roomId, 'game-started', {});
            return NextResponse.json(updatedRoom);
        }

        // Update game state - ensure data is serializable
        if (action === 'updateState') {
            if (!data) {
                return NextResponse.json({ error: 'Data required for updateState' }, { status: 400 });
            }
            
            // Deep clean the data to ensure it's JSON serializable
            const cleanData = JSON.parse(JSON.stringify(data));
            
            const updatedRoom = await prisma.room.update({
                where: { id: params.roomId },
                data: { gameState: cleanData }
            });

            await triggerRoomEvent(params.roomId, 'state-updated', cleanData);
            return NextResponse.json(updatedRoom);
        }

        // Handle game end
        if (action === 'end') {
            if (!data) {
                return NextResponse.json({ error: 'Data required for end' }, { status: 400 });
            }
            
            const finalState = JSON.parse(JSON.stringify(data));
            const winnerId = finalState.results?.winnerId;

            // Update stats for everyone in the room
            const roomPlayers = await prisma.roomPlayer.findMany({
                where: { roomId: params.roomId, isSpectator: false }
            });

            for (const p of roomPlayers) {
                const isWinner = p.userId === winnerId;
                if (isWinner) {
                    await prisma.user.update({
                        where: { id: p.userId },
                        data: { wins: { increment: 1 } }
                    });
                } else {
                    await prisma.user.update({
                        where: { id: p.userId },
                        data: { losses: { increment: 1 } }
                    });
                }
            }

            const updatedRoom = await prisma.room.update({
                where: { id: params.roomId },
                data: {
                    status: 'FINISHED',
                    gameState: finalState // Store final results in DB
                }
            });

            await triggerRoomEvent(params.roomId, 'game-ended', finalState);
            return NextResponse.json(updatedRoom);
        }

        // Handle player leave
        if (action === 'leave') {
            await prisma.roomPlayer.deleteMany({
                where: { roomId: params.roomId, userId: userId }
            });
            await triggerRoomEvent(params.roomId, 'player-left', { userId: userId });
            return NextResponse.json({ success: true });
        }

        // Handle room-scoped chat message
        if (action === 'chatMessage') {
            const rawText = typeof data?.text === 'string' ? data.text : '';
            const text = rawText.trim();
            if (!text) {
                return NextResponse.json({ error: 'Message text required' }, { status: 400 });
            }

            const inRoom = room.players.some((p) => p.userId === userId);
            if (!inRoom) {
                return NextResponse.json({ error: 'You are not in this room' }, { status: 403 });
            }

            const nowIso = new Date().toISOString();
            const message = {
                user: userId,
                text,
                timestamp: nowIso
            };

            const currentState = (room.gameState && typeof room.gameState === 'object')
                ? JSON.parse(JSON.stringify(room.gameState))
                : {};
            const existingMessages = Array.isArray(currentState.chatMessages) ? currentState.chatMessages : [];
            const nextMessages = [...existingMessages, message].slice(-200);

            const updatedState = {
                ...currentState,
                chatMessages: nextMessages
            };

            await prisma.room.update({
                where: { id: params.roomId },
                data: { gameState: updatedState }
            });

            await triggerRoomEvent(params.roomId, 'chat-message', message);
            return NextResponse.json({ success: true, message });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as { code?: string }).code;
        
        if (process.env.NODE_ENV === 'development') {
            console.error('[ROOM STATE ERROR]', {
                errorMessage,
                errorCode,
                stack: error instanceof Error ? error.stack : undefined
            });
        }

        return NextResponse.json({
            error: 'Failed to update room',
            details: errorMessage,
            code: errorCode
        }, { status: 500 });
    }
}
